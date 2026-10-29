// Shop screen, coin and booster icons, and the level-intro booster picker.
// Drawing only: every text and widget goes through ui.text / ui.button / ui.panel / ui.record so
// the game's overlap checker can verify the layout. Input is routed by the game from button ids:
//   store:  'back', 'tab:boosters', 'tab:skins', 'buy:<boosterId>', 'skin:<skinId>' (buy or equip), 'ad:coins'
//   picker: 'boost:<boosterId>', 'shop'
import { ICON } from './ui.js';
import { BOOSTERS, BOOSTER_ORDER, SKINS, SKIN_ORDER, AD_REWARDS, MAX_OWNED, canAfford, canAffordSkin, ownedCount, ownsSkin, equippedSkin } from '../economy.js';

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
const D = { pad: 14, tabY: 64, tabH: 34, top: 106, gap: 9, cardH: 88, adH: 54, adGap: 14, minW1: 330, minW2: 300 };

function planLayout(W, H, u) {
  const sMax = Math.min(1.55, u * 1.18);
  const need1 = D.top + 5 * D.cardH + 4 * D.gap + D.adGap + D.adH + D.pad;
  const need2 = D.top + 3 * D.cardH + 2 * D.gap + D.pad;
  const s1 = Math.min(sMax, H / need1, W / (D.minW1 + 2 * D.pad));
  const s2 = Math.min(sMax, H / need2, W / (2 * D.minW2 + 2 * D.pad + D.gap));
  return s2 > s1 * 1.08 ? { cols: 2, s: Math.max(0.5, s2) } : { cols: 1, s: Math.max(0.5, s1) };
}

// One shop card. item: { key, name, line, icon(ctx, cx, cy, size, t, bounce), btn: {id, label, color, dark,
// disabled, coin, size}, sub: { text, color } | null, flash }
function drawCard(ui, ctx, item, x, y, cw, ch, s, t, wide) {
  const flash = item.flash;
  const fl = flash < 0.9 ? 1 - flash / 0.9 : 0;
  ui.panel(x, y, cw, ch, { fill: 'rgba(44,31,20,0.9)', r: 16 * s, border: fl ? `rgba(255,226,120,${0.35 + 0.65 * fl})` : 'rgba(255,224,170,0.28)', record: true, tag: 'panel:card:' + item.key });
  if (fl) ui.panel(x - 2 * s, y - 2 * s, cw + 4 * s, ch + 4 * s, { fill: 'rgba(255,226,120,0)', r: 18 * s, border: `rgba(255,226,120,${0.6 * fl})` });

  const p = 9 * s;
  const it = ch - 2 * p;
  const ix = x + p, iy = y + p;
  ui.panel(ix, iy, it, it, { fill: 'rgba(255,230,180,0.13)', border: 'rgba(255,230,180,0.2)', r: 12 * s });
  ui.record({ x: ix, y: iy, w: it, h: it }, 'store:icon:' + item.key);
  const bounce = flash < 0.6 ? 1 + 0.22 * Math.sin((flash / 0.6) * Math.PI) : 1;
  item.icon(ctx, ix + it / 2, iy + it / 2, it, t, bounce);

  // button (right) with an optional small line underneath
  const bh = 40 * s;
  const bSize = (item.btn.size || 19) * s;
  // ui.button pads with ui.u (not s), so make sure the label really fits
  const need = ui.measure(item.btn.label, bSize) + 24 * ui.u + (item.btn.coin ? bSize * 1.05 + 8 * ui.u : 0);
  const bw = Math.min(Math.max((wide ? 92 : 84) * s, need), cw * 0.4);
  const subSize = 12.5 * s;
  const stackH = bh + (item.sub ? 3 * s + subSize * 1.1 : 0);
  const bx = x + cw - p - bw;
  const by = y + (ch - stackH) / 2;
  const B = item.btn;
  ui.button(B.id, B.label, bx, by, bw, bh, {
    color: B.color, dark: B.dark, disabled: B.disabled, icon: B.coin ? coinIcon(t) : null, size: bSize,
  });
  if (item.sub) {
    ui.text(item.sub.text, bx + bw / 2, by + bh + 3 * s + subSize * 0.55, { size: subSize, align: 'center', maxW: bw, color: fl ? '#fff2a0' : item.sub.color, tag: 'store:sub:' + item.key });
  }

  // name + one-line explanation (wrapped), centered vertically in the middle column
  const tx = ix + it + 10 * s;
  const tw = bx - 10 * s - tx;
  const nameSize = 17 * s;
  const maxDescH = ch - 2 * p - nameSize * 1.2;
  const maxLines = Math.max(2, Math.min(3, Math.floor(maxDescH / (10.5 * s * 1.18))));
  const desc = fitWrap(ui, item.line, tw, maxLines, 13.5 * s, 10.5 * s);
  const lineH = desc.size * 1.18;
  const blockH = nameSize * 1.2 + desc.lines.length * lineH;
  let cy = y + (ch - blockH) / 2;
  ui.text(item.name, tx, cy + nameSize * 0.6, { size: nameSize, maxW: tw, color: '#ffe8b0', tag: 'store:name:' + item.key });
  cy += nameSize * 1.2;
  desc.lines.forEach((ln, i) => {
    ui.text(ln, tx, cy + lineH * (i + 0.5), { size: desc.size, maxW: tw, color: 'rgba(255,255,255,0.82)', tag: `store:desc:${item.key}:${i}` });
  });
}

const GREEN = { color: '#46b83d', dark: '#2a7a24' };
const GREY = { color: '#7c7064', dark: '#40382f' };

function boosterItem(id, st) {
  const b = BOOSTERS[id];
  const owned = ownedCount(st.wallet, id);
  const ok = canAfford(st.wallet, id);
  const maxed = owned >= MAX_OWNED;
  return {
    key: id, name: b.name, line: b.line,
    flash: st.flash && st.flash.id === id ? st.flash.t : 99,
    icon: (ctx, cx, cy, it, t, bounce) => drawBoosterIcon(ctx, id, cx, cy, it * 0.78 * bounce, t),
    btn: { id: 'buy:' + id, label: maxed ? 'Max' : String(b.price), disabled: !ok, coin: !maxed, ...(ok ? GREEN : GREY) },
    sub: { text: 'Owned ' + owned, color: owned > 0 ? '#b6f0a0' : 'rgba(255,255,255,0.55)' },
  };
}

function skinItem(id, st) {
  const k = SKINS[id];
  const w = st.wallet;
  const owns = ownsSkin(w, id);
  const equipped = equippedSkin(w) === id;
  let btn;
  if (equipped) btn = { id: 'skin:' + id, label: 'Equipped', disabled: true, size: 15, color: '#46b83d', dark: '#2a7a24' };
  else if (owns) btn = { id: 'skin:' + id, label: 'Equip', size: 19, color: '#4a8fe8', dark: '#2a5aa8' };
  else {
    const ok = canAffordSkin(w, id);
    btn = { id: 'skin:' + id, label: String(k.price), coin: true, disabled: !ok, ...(ok ? GREEN : GREY) };
  }
  return {
    key: 'skin:' + id, name: k.name, line: k.line,
    flash: st.flash && st.flash.id === 'skin:' + id ? st.flash.t : 99,
    icon: (ctx, cx, cy, it, t, bounce) => drawSkinPreview(ctx, id, cx, cy + it * 0.02, it * 0.8 * bounce, t),
    btn, sub: null,
  };
}

export function drawStore(ui, ctx, W, H, state) {
  const { wallet, t = 0, adReady = false, adCooldownLeft = 0, flash = null, tab = 'boosters' } = state;
  const st = { wallet, t, flash };
  const { cols, s } = planLayout(W, H, ui.u);
  const pad = D.pad * s;

  // dim whatever is behind
  ctx.fillStyle = 'rgba(16,10,6,0.8)';
  ctx.fillRect(0, 0, W, H);

  // ---- header: back, title, balance
  const bs = 46 * s;
  ui.button('back', '', pad, pad, bs, bs, { color: '#5a8dee', dark: '#2f5bb0', icon: ICON.rewind });
  const headCy = pad + bs / 2 - 2 * s;
  ui.text('Shop', W / 2, headCy, { size: 30 * s, align: 'center', color: '#ffe8b0', stroke: 'rgba(0,0,0,0.5)', tag: 'store:title' });

  const coinFl = flash && (flash.id === 'coins' || flash.id === 'ad') && flash.t < 0.9 ? 1 - flash.t / 0.9 : 0;
  const balStr = String(wallet.coins);
  const balSize = 22 * s;
  const cr = 13 * s;
  const tw = ui.measure(balStr, balSize);
  const ph = 38 * s;
  const pw = 10 * s + cr * 2 + 6 * s + tw + 12 * s;
  const px = W - pad - pw, py = headCy - ph / 2;
  ui.panel(px, py, pw, ph, { fill: 'rgba(0,0,0,0.4)', r: ph / 2, border: coinFl ? `rgba(255,226,120,${0.4 + 0.6 * coinFl})` : 'rgba(255,224,170,0.3)' });
  drawCoin(ctx, px + 10 * s + cr, py + ph / 2, cr * (1 + 0.15 * coinFl), t);
  ui.record({ x: px + 10 * s, y: py + ph / 2 - cr, w: cr * 2, h: cr * 2 }, 'store:coinicon', 'store:balance');
  ui.text(balStr, px + 10 * s + cr * 2 + 6 * s, py + ph / 2, { size: balSize, color: coinFl ? '#fff2a0' : '#fff', stroke: 'rgba(0,0,0,0.4)', tag: 'store:balance', group: 'store:balance' });

  // ---- tabs
  const tabW = Math.min(150 * s, (W - 2 * pad - 8 * s) / 2), tabH = D.tabH * s;
  const tabX = W / 2 - tabW - 4 * s, tabY = D.tabY * s;
  for (const [i, [id, label]] of [['boosters', 'Boosters'], ['skins', 'Skins']].entries()) {
    const on = tab === id;
    ui.button('tab:' + id, label, tabX + i * (tabW + 8 * s), tabY, tabW, tabH, {
      color: on ? '#e0a526' : '#6d5a48', dark: on ? '#9a6a08' : '#3e3125', size: 17 * s,
    });
  }

  // ---- body
  const ch = D.cardH * s, gap = D.gap * s;
  const bodyTop = D.top * s;
  const items = tab === 'skins' ? SKIN_ORDER.map((id) => skinItem(id, st)) : BOOSTER_ORDER.map((id) => boosterItem(id, st));
  const adLabelFull = `Watch ad: +${AD_REWARDS.freeCoins.coins} coins`;
  const cooling = adCooldownLeft > 0;
  const adLabel = cooling ? `Free coins in ${fmtTime(adCooldownLeft)}` : adReady ? adLabelFull : 'Ad loading...';
  const adOff = cooling || !adReady;
  const adBtn = (x, y, w, h) => ui.button('ad:coins', adLabel, x, y, w, h, {
    color: '#e0a526', dark: '#9a6a08', ad: !adOff, disabled: adOff, size: Math.min(19 * s, h * 0.38),
  });

  if (cols === 1) {
    const cw = Math.min(W - 2 * pad, 520 * s);
    const adH = D.adH * s, adGap = D.adGap * s;
    const total = 5 * ch + 4 * gap + adGap + adH;
    const avail = H - bodyTop - pad;
    const y0 = bodyTop + Math.max(0, (avail - total) / 2);
    const x0 = W / 2 - cw / 2;
    items.forEach((it, i) => drawCard(ui, ctx, it, x0, y0 + i * (ch + gap), cw, ch, s, t, true));
    adBtn(x0, y0 + 5 * ch + 4 * gap + adGap, cw, adH);
  } else {
    const cw = Math.min((W - 2 * pad - gap) / 2, 440 * s);
    const total = 3 * ch + 2 * gap;
    const avail = H - bodyTop - pad;
    const y0 = bodyTop + Math.max(0, (avail - total) / 2);
    const x0 = W / 2 - cw - gap / 2;
    items.forEach((it, i) => drawCard(ui, ctx, it, x0 + (i % 2) * (cw + gap), y0 + Math.floor(i / 2) * (ch + gap), cw, ch, s, t, false));
    // 6th cell: the free-coins ad
    const ax = x0 + cw + gap, ay = y0 + 2 * (ch + gap);
    ui.panel(ax, ay, cw, ch, { fill: 'rgba(44,31,20,0.9)', r: 16 * s, border: 'rgba(255,224,170,0.28)', record: true, tag: 'panel:card:ad' });
    const bh = D.adH * s;
    adBtn(ax + 9 * s, ay + (ch - bh) / 2, cw - 18 * s, bh);
  }
}

// ---------------------------------------------------------------- egg skins and chests

// An egg of the given skin, centered at (cx, cy), egg height h (y-down local space).
export function drawSkinPreview(ctx, id, cx, cy, h, t = 0) {
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
      color: '#d49a1c', dark: '#8a5f0a', icon: coinIcon(t), size: Math.min(18 * u, cs * 0.42),
    });
    ui.text('Spend coins on start boosters', x + w / 2, lineCy, { size: lineSize, align: 'center', maxW: w, color: 'rgba(255,255,255,0.8)', tag: 'picker:hint' });
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
    ui.button('boost:' + id, '', cx, cy0, c, c, {
      color: on ? '#46b83d' : '#7a6552',
      dark: on ? '#2a7a24' : '#44362a',
    });
    // icon, nudged down-left so the badge has the corner
    const body = c - 5 * u * Math.min(1, c / 40);
    drawBoosterIcon(ctx, id, cx + c * 0.46, cy0 + body * 0.52, c * 0.6, t);
    if (on) {
      ctx.save();
      ctx.lineWidth = Math.max(2, c * 0.05);
      ctx.strokeStyle = '#fff6c0';
      ui.panel(cx - 1, cy0 - 1, c + 2, c + 2, { fill: 'rgba(0,0,0,0)', r: 14 * u, border: '#fff6c0' });
      ctx.restore();
    }
    // count badge (top right, inside the chip)
    const br = Math.max(6, c * 0.2);
    const bcx = cx + c - br - c * 0.04, bcy = cy0 + br + c * 0.04;
    ctx.beginPath();
    ctx.arc(bcx, bcy, br, 0, Math.PI * 2);
    ctx.fillStyle = '#2b1d12';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffe8b0';
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
  ui.text(str, x + w / 2, lineCy, { size: lineSize, align: 'center', maxW: w, color: tapped ? '#ffe8b0' : 'rgba(255,255,255,0.7)', tag: 'picker:line' });
}
