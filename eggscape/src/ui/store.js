// Shop screen, coin and booster icons, and the level-intro booster picker.
// Drawing only: every text and widget goes through ui.text / ui.button / ui.panel / ui.record so
// the game's overlap checker can verify the layout. Input is routed by the game from button ids:
//   store:  'back', 'home', 'store:coins' (jump to the coin packs), 'tab:deals|boosters|hens|skins',
//           'iap:<sku>' (real money), 'buy:<boosterId>', 'item:<ally|goldhour|skip>', 'chick:<strikeId>',
//           'charge:chick|chick3|chick10', 'skin:<skinId>' / 'hen:<henSkinId>' (buy or equip), 'ad:coins',
//           'kit:<kitId>' / 'hset:<setId>' (coin bundles), 'home:chest' (daily gift), 'sample' (free sample / free boost),
//           'tile:<key>' (a tile or a bundle's art: the detail sheet; a real-money card anywhere: 'tile:iap:<sku>', its
//           sheet pays), 'deal:buy' (TODAY'S DEAL, coins)
//   A coin button the player cannot afford stays tappable (off face): the game answers with its "Get more" sheet.
//   picker: 'boost:<boosterId>', 'shop'
import { glideStep, snapPx } from '../scroll.js';
import { focusY, focusTrip, focusLook, focusDraw, focusHand } from './focus.js'; // 0.8.16: the one "scroll to it and point at it"
import { drawEggSkinArt } from '../render/eggskins.js';
import { pictoPerk } from './picto.js'; // an egg skin's power as one glyph
import { ICON, C, tint, drawAdBadge } from './ui.js';
import { themeBack } from './theme.js';
import { BOOSTERS, BOOSTER_ORDER, pageOf, SKINS, SKIN_ORDER, AD_REWARDS, MAX_OWNED, canAfford, canAffordSkin, ownedCount, ownsSkin, equippedSkin,
  CHARGE_PACKS, MAX_CHARGES, HEN_SKINS, HEN_SKIN_ORDER, ownsHenSkin, ITEMS, ITEM_ORDER, itemCount, CHICK_PRICES, ownsChick, skinPerk,
  IAP, COIN_PACKS, iapAvailable, usdHint, BANK_OPEN, BANK_CAP, BUNDLES, bundleParts, bundleTimes, CHICK_IDS,
  KITS, KIT_ORDER, kitPrice, kitSave, kitFull, SETS, SET_ORDER, setAvailable, setPrice, setSave, sampleFor, bundleValue, dailyDeal, DEAL_OFF, unlockPrice, couponHeld } from '../economy.js';
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
  } else if (id === 'scare') {
    // Scarecrow (0.8.15): a burlap head with button eyes and a stitched grin under a floppy straw hat, on its post.
    // It sways a little; straw sticks out at the neck and the hat brim.
    const sw = 0.05 * Math.sin(t * 2.2);
    // the post and the cross arm with straw cuffs
    ctx.fillStyle = '#8a5a2c'; ctx.strokeStyle = '#4a2c10'; ctx.lineWidth = lw(0.035);
    ctx.beginPath(); ctx.roundRect(-0.045, 0.1, 0.09, 0.4, 0.02); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(0, 0.27); ctx.rotate(sw * 0.5);
    ctx.beginPath(); ctx.roundRect(-0.4, -0.04, 0.8, 0.08, 0.03); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#e8b83a'; ctx.lineWidth = lw(0.03);
    for (const sd of [-1, 1]) for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(sd * 0.36, 0); ctx.lineTo(sd * (0.47 + 0.02 * Math.abs(k)), k * 0.07); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.translate(0, 0.05); ctx.scale(1.16, 1.16); ctx.rotate(sw);
    // straw collar
    ctx.strokeStyle = '#e8b83a'; ctx.lineWidth = lw(0.035);
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 0.045, 0.1); ctx.lineTo(i * 0.075, 0.22 + 0.02 * (i % 2 ? 1 : -1)); ctx.stroke(); }
    // the head: a burlap sack
    const hg = ctx.createLinearGradient(-0.22, -0.3, 0.22, 0.14);
    hg.addColorStop(0, '#f1d9a4'); hg.addColorStop(1, '#d2a866');
    ctx.beginPath(); ctx.ellipse(0, -0.08, 0.235, 0.215, 0, 0, Math.PI * 2); ctx.fillStyle = hg; ctx.fill();
    ctx.lineWidth = lw(0.04); ctx.strokeStyle = '#7a4f22'; ctx.stroke();
    // a patch
    ctx.save(); ctx.translate(0.13, 0.0); ctx.rotate(0.3);
    ctx.fillStyle = '#c46a3a'; ctx.fillRect(-0.05, -0.04, 0.1, 0.08);
    ctx.strokeStyle = '#7a3a1a'; ctx.lineWidth = lw(0.014); ctx.setLineDash([0.02, 0.02]); ctx.strokeRect(-0.05, -0.04, 0.1, 0.08); ctx.setLineDash([]);
    ctx.restore();
    // button eyes
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.arc(sd * 0.085, -0.1, 0.048, 0, Math.PI * 2); ctx.fillStyle = '#2e2018'; ctx.fill();
      ctx.fillStyle = '#f6e7c4'; ctx.beginPath(); ctx.arc(sd * 0.085 - 0.014, -0.112, 0.011, 0, Math.PI * 2); ctx.arc(sd * 0.085 + 0.014, -0.088, 0.011, 0, Math.PI * 2); ctx.fill();
    }
    // a carrot-stub nose and the stitched grin
    ctx.beginPath(); ctx.moveTo(-0.022, -0.045); ctx.lineTo(0.022, -0.045); ctx.lineTo(0, -0.005); ctx.closePath(); ctx.fillStyle = '#e8762a'; ctx.fill();
    ctx.strokeStyle = '#5a3414'; ctx.lineWidth = lw(0.024);
    ctx.beginPath(); ctx.arc(0, -0.02, 0.12, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
    ctx.lineWidth = lw(0.018);
    for (const a of [0.33, 0.5, 0.67]) { const x = Math.cos(a * Math.PI) * 0.12, y = -0.02 + Math.sin(a * Math.PI) * 0.12; ctx.beginPath(); ctx.moveTo(x, y - 0.025); ctx.lineTo(x, y + 0.025); ctx.stroke(); }
    // the hat: wide floppy brim, dented crown, a red band
    ctx.fillStyle = '#d99a2e'; ctx.strokeStyle = '#7a4f12'; ctx.lineWidth = lw(0.04);
    ctx.beginPath(); ctx.ellipse(0, -0.235, 0.36, 0.075, -0.06, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-0.17, -0.25); ctx.quadraticCurveTo(-0.15, -0.5, 0.0, -0.47); ctx.quadraticCurveTo(0.17, -0.5, 0.17, -0.26); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-0.172, -0.3); ctx.quadraticCurveTo(0, -0.25, 0.172, -0.31); ctx.lineWidth = lw(0.055); ctx.strokeStyle = '#d8342a'; ctx.stroke();
    ctx.strokeStyle = '#f2c85a'; ctx.lineWidth = lw(0.022);
    for (const [x0, x1] of [[-0.3, -0.39], [0.27, 0.37], [-0.2, -0.26]]) { ctx.beginPath(); ctx.moveTo(x0, -0.22); ctx.lineTo(x1, -0.16); ctx.stroke(); }
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

let AD_NOW = 40; // what the next free-coins video pays (drawStore sets it)
function fmtTime(sec) {
  if (sec >= 3600) return 'Tomorrow'; // the day's free videos are used up
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
    strikeSub(ui, ctx, item.sub, bx + bw / 2, by + bh + 3 * s + subSize * 0.55, subSize, s, false);
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
  const nmS = fitWrap(ui, item.name, tw, 1, nameSize, nameSize * 0.72).size;
  ui.text(item.name, tx, cy + nameSize * 0.6, { size: nmS, maxW: tw, color: C.ink, tag: 'store:name:' + item.key });
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
    if (item.sub) { ui.text(item.sub.text, xr, cy + 9.5 * s, { size: 12.5 * s, align: 'right', maxW: tw - pw - 6 * s, color: item.sub.color, tag: 'store:sub:' + item.key }); strikeSub(ui, ctx, item.sub, xr, cy + 9.5 * s, 12.5 * s, s, true); }
    cy += 23 * s;
  }
  const nameSize = fitWrap(ui, item.name, tw, 1, 21 * s, 15 * s).size; // shrink a long name (Unlock Everything) rather than cut it
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

// TODAY'S DEAL on this item (st.deal: dailyDeal for today, set by drawStore / storeItem): the item's own tile and sheet
// show the same deal price and buy through 'deal:buy'
const dealOn = (st, key) => (st.deal && !st.deal.done && st.deal.key === key ? st.deal : null);
const OFF_TAG = Math.round(DEAL_OFF * 100) + '% off';
// THE HALF-PRICE TICKET (0.8.15, won on the wheel; economy.js COUPON): while one is held, every skin, outfit and chick
// still to own shows half its price with the old one struck through; the first one bought uses the ticket up. No clock.
const TICKET_COL = '#7a48e8';
function withTicket(item, st, list) {
  const U = unlockPrice(st.wallet, list);
  if (!U.coupon || item.owned || !item.btn || item.btn.disabled || !item.btn.coin) return item;
  return { ...item, btn: { ...item.btn, label: String(U.price), ...(st.wallet.coins >= U.price ? GREEN : GREY) }, sub: { text: String(U.was), color: 'rgba(110,70,30,0.8)', strike: true }, ticket: U };
}
// a sub line that is an old price: struck through in red (cx: its middle, or its right edge with right = true)
function strikeSub(ui, ctx, sub, x, y, size, s, right) {
  if (!sub || !sub.strike) return;
  const w = ui.measure(sub.text, size), x0 = right ? x - w : x - w / 2;
  ctx.save(); ctx.strokeStyle = '#e8402e'; ctx.lineWidth = 2.2 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0 - 2 * s, y + size * 0.16); ctx.lineTo(x0 + w + 2 * s, y - size * 0.16); ctx.stroke(); ctx.restore();
}
function withDeal(item, st) {
  const D = dealOn(st, item.key);
  if (!D || item.ticket) return item; // a ticket in hand is the better price: the item shows that
  return { ...item, badge: OFF_TAG + ' today', badgeCol: '#e8402e', btn: { id: 'deal:buy', label: String(D.price), coin: true, ...(st.wallet.coins >= D.price ? GREEN : GREY) }, sub: { text: `Today's deal, was ${D.was}`, color: '#c0392b' }, deal: D };
}

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
  const P = skinPerk(id);
  return withDeal(withTicket({
    key: 'skin:' + id, name: k.name, line: k.line, perk: P, owned: owns, trying: !owns && st.trial && st.trial.skin === id, // perk: the power shows as its own chip and row (drawTile, main.js perkRow)
    flash: flashOf(st, 'skin:' + id),
    icon: (ctx, cx, cy, it, t, bounce) => drawSkinPreview(ctx, id, cx, cy + it * 0.02, it * 0.8 * bounce, t),
    btn, sub: null,
  }, st, k.price), st);
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
  return withTicket({
    key: 'chick:' + S.id, name: S.name, owned: mine, badge: mine || S.premium ? null : 'Lv ' + S.unlock, premium: !!S.premium,
    line: S.premium ? `${S.up} Downside: ${S.down}${mine ? '' : ' Premium: coins only.'}` : mine ? 'Yours: usable in every level with villains.' : `Free at level ${S.unlock}. Or unlock it now.`,
    flash: flashOf(st, 'chick:' + S.id),
    icon: (ctx, cx, cy, it, t, bounce) => {
      drawStrikeToken(ctx, S.id, cx, cy, it * 0.38 * bounce, t, mine);
      if (!mine) padlock(ctx, cx + it * 0.27, cy + it * 0.27, it * 0.13);
    },
    btn: mine ? OWNED('chick:' + S.id, 'Yours') : { id: 'chick:' + S.id, label: String(price), coin: true, ...(ok ? GREEN : GREY) },
    sub: mine ? null : { text: S.premium ? 'Premium chick' : 'Unlock now', color: S.premium ? '#b0700a' : C.ink2 },
  }, st, mine ? 0 : price);
}

// the hen in a skin, standing, for the shop card (the global skin is put back right after)
export function drawHenSkinPreview(ctx, id, cx, cy, h, t) {
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
  else if (k.premium) btn = { id: 'tile:iap:' + PREMIUM, label: 'Unlock all', size: 16, kind: 'gold' }; // what Unlock Everything holds first
  else { const ok = w.coins >= k.price; btn = { id: 'hen:' + id, label: String(k.price), coin: true, ...(ok ? GREEN : GREY) }; }
  return withDeal(withTicket({
    key: 'hen:' + id, name: k.name, line: k.line, owned: owns, trying: !owns && st.trial && st.trial.hen === id,
    flash: flashOf(st, 'hen:' + id),
    icon: (ctx, cx, cy, it, t, bounce) => drawHenSkinPreview(ctx, id, cx, cy + it * 0.04, it * 0.84 * bounce, t),
    btn, sub: null,
  }, st, k.premium ? 0 : k.price), st);
}

const PREMIUM = 'eggscape_premium';
// a real-money product as a card: the localized price (or the USD hint) on the button, "Owned" once a one-time one is bought
function iapItem(sku, st, o = {}) {
  const P = IAP[sku], can = iapAvailable(st.wallet, sku), id = (o.pre || 'iap:') + sku;
  return {
    key: (o.pre || 'iap:') + sku, name: o.name || P.name, line: o.line || P.line, owned: !can, big: !!o.big, tag: o.tag, tall: sku === PREMIUM,
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
    line: open ? `${fmtNum(b)} coins inside!` : 'Wins fill it up.',
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
export function drawItemArt(ctx, id, cx, cy, it, t) {
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
  if (sku === PREMIUM) { // the Golden Hen, her golden egg, and the power chicks at her feet
    drawStrikeToken(ctx, 'thunder', cx - it * 0.33, cy + it * 0.22, it * 0.13, t, true);
    drawHenSkinPreview(ctx, 'golden', cx - it * 0.02, cy + it * 0.02, it * 0.8, t);
    drawSkinPreview(ctx, 'golden', cx + it * 0.3, cy + it * 0.24, it * 0.3, t);
    sparkle(ctx, cx + it * 0.3, cy - it * 0.3, it * 0.08, 0.6 + 0.4 * Math.sin(t * 3));
    return;
  }
  if (sku === 'eggscape_collector') { // the whole coop: three hens in their best outfits and a row of eggs
    drawHenSkinPreview(ctx, 'pirate', cx - it * 0.24, cy - it * 0.02, it * 0.56, t);
    drawHenSkinPreview(ctx, 'santa', cx + it * 0.24, cy - it * 0.02, it * 0.56, t + 1);
    drawHenSkinPreview(ctx, 'royal', cx, cy - it * 0.06, it * 0.66, t + 2);
    ['galaxy', 'golden', 'lava', 'pearl'].forEach((e, i) => drawSkinPreview(ctx, e, cx + (i - 1.5) * it * 0.17, cy + it * 0.32, it * 0.2, t));
    sparkle(ctx, cx + it * 0.36, cy - it * 0.32, it * 0.07, 0.6 + 0.4 * Math.sin(t * 3));
    return;
  }
  if (sku === 'starter_nest') { drawHenSkinPreview(ctx, P.hen, cx - it * 0.08, cy + it * 0.02, it * 0.74, t); coinPile(ctx, cx + it * 0.26, cy + it * 0.24, it * 0.6, 3, t); return; }
  // the Helper Bundle: power chicks over a pile of coins, and an Ally Ticket
  coinPile(ctx, cx, cy + it * 0.16, it * 0.8, 3, t);
  for (const [id, dx, dy] of [['freeze', -0.18, -0.12], ['thunder', 0.18, -0.12]]) drawStrikeToken(ctx, id, cx + dx * it, cy + dy * it, it * 0.19, t, true);
  drawItemArt(ctx, 'ally', cx + it * 0.26, cy + it * 0.28, it * 0.42, t);
}

// ---------------------------------------------------------------- shop 2.0 (2026-11-20): bundles as pictures
// mykee: "less text, show don't tell", "sell bundles, not single items", "the user must not feel bad in the shop".
// A bundle card is its art, a strip of what is inside (icons with count badges, all counted from economy.js
// bundleParts), a value badge computed from the price tables (bundleTimes: never typed in, never a fake "was" price)
// and one price button. The art opens the detail sheet with the whole list in words.

// a bundle's content strip: [{ art, n, word }] (n: the count badge, '' for none; word: one short word under it, 0.8.9:
// "nobody can tell what x17 or a crossed circle is")
function partsOf(sku) {
  const B = bundleParts(sku);
  if (!B) return [];
  const out = [], hens = B.hens.length > 2 ? [{ art: 'hens', n: 'x' + B.hens.length, word: 'outfits' }] : B.hens.map((h) => ({ art: 'hen:' + h, n: '', word: 'outfit' }));
  const eggs = B.eggs.length > 1 ? [{ art: 'eggs', n: 'x' + B.eggs.length, word: 'eggs' }] : B.eggs.map((e) => ({ art: 'egg:' + e, n: '', word: 'egg' }));
  const chicks = B.chicks.length ? [{ art: B.chicks.length > CHICK_IDS.length ? 'chicks9' : 'chicks', n: 'x' + B.chicks.length, word: 'chicks' }] : [];
  const perks = B.premium ? [{ art: 'bonus', n: '', word: 'every bonus' }, { art: 'levels', n: '', word: 'all levels' }] : []; // 0.8.17 (mykee): no word about videos on what is paid for
  const coins = B.coins ? [{ art: 'coins', n: fmtNum(B.coins), word: 'coins' }] : [];
  if (B.hens.length > 2) out.push(...hens, ...eggs, ...chicks, ...coins, ...perks); // the coop: the wardrobe first
  else if (B.premium) out.push(...perks, ...chicks, ...hens, ...eggs, ...coins);
  else out.push(...coins, ...hens, ...eggs, ...chicks);
  if (B.charges) out.push({ art: 'charge', n: 'x' + B.charges, word: 'charges' });
  if (B.boosts) out.push({ art: 'boosts', n: 'x' + B.boosts, word: 'boosts' });
  if (B.ally) out.push({ art: 'ally', n: 'x' + B.ally, word: 'tickets' });
  if (B.daily) out.push({ art: 'daily', n: '', word: 'daily' });
  return out;
}

// one content icon, centred in a cell of size c
export function drawPart(ctx, art, cx, cy, c, t) {
  if (art.startsWith('boost:')) return drawBoosterIcon(ctx, art.slice(6), cx, cy, c * 0.82, t);
  if (art.startsWith('chick:')) return drawStrikeToken(ctx, art.slice(6), cx, cy, c * 0.34, t, true);
  if (art === 'coins') return coinPile(ctx, cx, cy, c * 0.95, 3, t);
  if (art === 'charge') return drawStrikeToken(ctx, 'freeze', cx, cy, c * 0.34, t, true);
  if (art === 'ally') return drawItemArt(ctx, 'ally', cx, cy, c * 1.05, t);
  if (art === 'boosts') { drawBoosterIcon(ctx, 'stone', cx - c * 0.2, cy + c * 0.08, c * 0.5, t); drawBoosterIcon(ctx, 'time', cx + c * 0.2, cy + c * 0.1, c * 0.5, t); drawBoosterIcon(ctx, 'golden', cx, cy - c * 0.1, c * 0.52, t); return; }
  if (art === 'chicks' || art === 'chicks9') {
    const ids = art === 'chicks' ? ['bomb', 'thunder', 'freeze'] : ['tock', 'bubble', 'phoenix'];
    drawStrikeToken(ctx, ids[0], cx - c * 0.2, cy + c * 0.1, c * 0.2, t, true); drawStrikeToken(ctx, ids[1], cx + c * 0.2, cy + c * 0.1, c * 0.2, t, true); drawStrikeToken(ctx, ids[2], cx, cy - c * 0.12, c * 0.22, t, true);
    return;
  }
  if (art.startsWith('hen:')) return drawHenSkinPreview(ctx, art.slice(4), cx, cy + c * 0.03, c * 0.9, t);
  if (art === 'hens') { drawHenSkinPreview(ctx, 'pirate', cx - c * 0.2, cy + c * 0.02, c * 0.66, t); drawHenSkinPreview(ctx, 'royal', cx + c * 0.12, cy + c * 0.04, c * 0.72, t + 1); return; }
  if (art.startsWith('egg:')) return drawSkinPreview(ctx, art.slice(4), cx, cy, c * 0.72, t);
  if (art === 'eggs') { drawSkinPreview(ctx, 'galaxy', cx - c * 0.18, cy + c * 0.04, c * 0.54, t); drawSkinPreview(ctx, 'lava', cx + c * 0.18, cy + c * 0.04, c * 0.54, t); drawSkinPreview(ctx, 'golden', cx, cy - c * 0.06, c * 0.6, t); return; }
  if (art === 'bonus') { // 0.8.17 every bonus, instantly: a gift box with a lightning bolt on it
    const w = c * 0.6, h = c * 0.46, x = cx - w / 2, y = cy - h / 2 + c * 0.08;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = c * 0.035; ctx.strokeStyle = '#6a1a10';
    ctx.fillStyle = '#e8402e'; ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff6a50'; ctx.beginPath(); ctx.rect(x - c * 0.04, y - c * 0.12, w + c * 0.08, c * 0.14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(cx - c * 0.05, y - c * 0.12, c * 0.1, h + c * 0.12);
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + d * c * 0.11, y - c * 0.17, c * 0.11, c * 0.065, d * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#fff6b0'; ctx.strokeStyle = '#8a5200'; ctx.lineWidth = c * 0.03; ctx.beginPath(); // the bolt, in front
    const bx = cx + c * 0.2, by = cy + c * 0.06;
    ctx.moveTo(bx + c * 0.06, by - c * 0.24); ctx.lineTo(bx - c * 0.1, by + c * 0.03); ctx.lineTo(bx, by + c * 0.03); ctx.lineTo(bx - c * 0.06, by + c * 0.26); ctx.lineTo(bx + c * 0.12, by - c * 0.04); ctx.lineTo(bx + c * 0.02, by - c * 0.04); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    return;
  }
  if (art === 'novideo') { // a video tile struck through: the bonuses come without one
    const w = c * 0.62, h = w * 0.72;
    drawAdBadge(ctx, cx - w / 2, cy, w, h);
    ctx.save(); ctx.strokeStyle = '#e8402e'; ctx.lineWidth = c * 0.075; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, c * 0.4, 0, Math.PI * 2); ctx.moveTo(cx - c * 0.28, cy - c * 0.28); ctx.lineTo(cx + c * 0.28, cy + c * 0.28); ctx.stroke(); ctx.restore();
    return;
  }
  if (art === 'levels') { // an open padlock: every level open
    ctx.save(); ctx.translate(cx, cy + c * 0.08);
    ctx.lineWidth = c * 0.09; ctx.strokeStyle = '#6a727a'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(c * 0.14, -c * 0.2, c * 0.15, Math.PI, 0); ctx.lineTo(c * 0.29, -c * 0.08); ctx.stroke();
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-c * 0.3, -c * 0.14, c * 0.46, c * 0.38, c * 0.07) : ctx.rect(-c * 0.3, -c * 0.14, c * 0.46, c * 0.38);
    ctx.fillStyle = '#ffc83a'; ctx.fill(); ctx.lineWidth = c * 0.045; ctx.strokeStyle = '#8a5200'; ctx.stroke();
    ctx.fillStyle = '#8a5200'; ctx.beginPath(); ctx.arc(-c * 0.07, c * 0.03, c * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  if (art === 'daily') { // a calendar page with a Chick Charge: one free every day
    ctx.save();
    const w = c * 0.62, h = c * 0.6, x = cx - w / 2 - c * 0.08, y = cy - h / 2 - c * 0.04;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, c * 0.08) : ctx.rect(x, y, w, h); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = c * 0.04; ctx.strokeStyle = '#7a5630'; ctx.stroke();
    ctx.fillStyle = '#e8402e'; ctx.fillRect(x + c * 0.02, y + c * 0.02, w - c * 0.04, h * 0.26);
    ctx.fillStyle = '#c9b89a'; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ctx.fillRect(x + w * (0.16 + i * 0.26), y + h * (0.44 + j * 0.24), w * 0.14, h * 0.12);
    ctx.restore();
    drawStrikeToken(ctx, 'freeze', cx + c * 0.2, cy + c * 0.18, c * 0.2, t, true);
  }
}

// a count badge under an icon: dark pill, white numerals, centred on (cx, y)
function countBadge(ui, ctx, str, cx, y, s, tag, group, maxW = 99 * s) {
  const sz = 11.5 * s, w = Math.min(maxW, Math.max(sz * 1.6, ui.measure(str, sz) + 9 * s)), h = sz * 1.4;
  ui.roundRect(cx - w / 2, y - h / 2, w, h, h / 2); ctx.fillStyle = '#5b3413'; ctx.fill();
  ctx.lineWidth = 1.2 * s; ctx.strokeStyle = 'rgba(255,236,200,0.85)'; ctx.stroke();
  ui.text(str, cx, y + 0.5 * s, { size: sz, align: 'center', color: '#fff', maxW: w - 6 * s, tag, group }); // a narrow cell shrinks the numerals, never lets them touch the next badge
}

// the strip of what a bundle holds: one or two rows of icon cells, each with its count. Returns the height used.
function stripLayout(n, w, maxH, s) {
  const g = 5 * s, badge = 24 * s; // the count badge and the word under each cell
  for (const rows of [1, 2]) {
    const per = Math.ceil(n / rows), c = Math.min(46 * s, (w - (per - 1) * g) / per, (maxH - rows * badge - (rows - 1) * g) / rows);
    if (c >= 30 * s || rows === 2) return { rows, per, c, g, badge, h: rows * (c + badge) + (rows - 1) * g };
  }
}
function drawStrip(ui, ctx, parts, x, y, w, maxH, s, t, key) {
  const L = stripLayout(parts.length, w, maxH, s), tag = 'store:strip:' + key;
  ui.record({ x, y, w, h: L.h }, tag);
  parts.forEach((P, i) => {
    const r = Math.floor(i / L.per), inRow = Math.min(L.per, parts.length - r * L.per), k = i - r * L.per;
    const x0 = x + (w - (inRow * L.c + (inRow - 1) * L.g)) / 2 + k * (L.c + L.g), y0 = y + r * (L.c + L.badge + L.g);
    ui.roundRect(x0, y0, L.c, L.c, 10 * s); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
    ctx.lineWidth = 1.2 * s; ctx.strokeStyle = 'rgba(122,80,40,0.28)'; ctx.stroke();
    drawPart(ctx, P.art, x0 + L.c / 2, y0 + L.c / 2 - (P.n ? 2 * s : 0), L.c * 0.86, t);
    if (P.n) countBadge(ui, ctx, P.n, x0 + L.c / 2, y0 + L.c + 1 * s, s, `${tag}:${i}`, tag, L.c + L.g - 2 * s);
    if (P.word) { // a narrow cell (seven at 360 px) puts "no videos" on two short lines rather than "no vide..."
      const mw = L.c + L.g - 1 * s, two = ui.measure(P.word, 11 * s) > mw && P.word.includes(' '), WL = two ? P.word.split(' ') : [P.word];
      WL.forEach((ln, q) => ui.text(ln, x0 + L.c / 2, y0 + L.c + (two ? 13.5 + q * 9.5 : 15.5) * s, { size: (two ? 9.5 : 11) * s, align: 'center', color: C.ink2, maxW: mw, tag: `${tag}:w${i}:${q}`, group: tag }));
    }
  });
  return L.h;
}

// the value badge: a gold starburst with the computed "6x" over "value"
export function valueBadge(ui, ctx, times, cx, cy, r, s, t, tag, group) {
  if (!(times >= 2)) return;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ui.calm ? 0 : Math.sin(t * 1.3) * 0.05);
  ctx.beginPath();
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, rr = i % 2 ? r * 0.84 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = '#e8402e'; ctx.fill(); ctx.lineWidth = 2 * s; ctx.strokeStyle = '#7a1a0a'; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2); ctx.lineWidth = 1.2 * s; ctx.strokeStyle = 'rgba(255,230,200,0.6)'; ctx.stroke();
  ctx.restore();
  ui.text(times + 'x', cx, cy - r * 0.14, { size: r * 0.66, align: 'center', color: '#fff', stroke: '#7a1a0a', strokeW: 3 * s, maxW: r * 1.5, tag, group });
  ui.text('value', cx, cy + r * 0.4, { size: r * 0.34, align: 'center', color: '#ffe9b0', maxW: r * 1.4, tag: tag + ':l', group });
}

// a tall card's art across its banner (bw x bh): the bundle's cast spread out over the width
function drawBanner(ctx, sku, cx, cy, bw, bh, t, wallet, k = 1) {
  const sp = Math.min(bw * 0.2, bh * 0.66), H = bh * 0.86 * k;
  if (sku === PREMIUM) { // the Golden Hen with her golden egg, the power chicks at her feet
    drawStrikeToken(ctx, 'thunder', cx - sp * 1.25, cy + bh * 0.2, bh * 0.12 * k, t, true);
    drawStrikeToken(ctx, 'freeze', cx - sp * 0.85, cy + bh * 0.28, bh * 0.12 * k, t + 1, true);
    drawStrikeToken(ctx, 'bomb', cx + sp * 1.3, cy + bh * 0.26, bh * 0.12 * k, t + 2, true);
    drawHenSkinPreview(ctx, 'golden', cx - sp * 0.1, cy + bh * 0.03, H, t);
    drawSkinPreview(ctx, 'golden', cx + sp * 0.62, cy + bh * 0.2, bh * 0.38 * k, t);
    sparkle(ctx, cx + sp * 0.9, cy - bh * 0.3, bh * 0.07, 0.6 + 0.4 * Math.sin(t * 3));
    sparkle(ctx, cx - sp * 0.95, cy - bh * 0.2, bh * 0.05, 0.6 + 0.4 * Math.sin(t * 3 + 2));
    return;
  }
  if (sku === 'eggscape_collector') { // three hens in their best outfits, a row of eggs in front
    const hx = cx - bw * 0.04; // a little left: the value badge has the top right corner
    for (const [id, dx, sc] of [['pirate', -1.05, 0.76], ['santa', 1.05, 0.76], ['royal', 0, 0.9]]) drawHenSkinPreview(ctx, id, hx + dx * sp, cy - bh * 0.04 + (1 - sc) * bh * 0.3, H * sc, t + dx);
    ['galaxy', 'thunder', 'golden', 'lava', 'pearl', 'robot'].forEach((e, i) => drawSkinPreview(ctx, e, cx + (i - 2.5) * Math.min(bh * 0.24, bw * 0.12), cy + bh * 0.33, bh * 0.24 * k, t));
    return;
  }
  drawIapArt(ctx, sku, cx, cy + bh * 0.02, Math.min(bh * 1.1, bw * 0.62) * k, t, wallet);
}

// ---- the bundle sheet (0.8.9, mykee: "if the user clicks on any bundle they should be able to see what they are
// getting"): G.detail 'iap:<sku>'. What is inside as rows [{ art, text, grid? }] (grid: [{ art, name }], the outfits /
// eggs / chicks one by one), counted from bundleParts like the strip. levels: how many levels the game has.
const STRIKE_NAME = (id) => (STRIKES.find((S) => S.id === id) || {}).name || id;
export function iapRows(sku, levels = 50) {
  const P = IAP[sku];
  if (!P) return [];
  if (COIN_PACKS.includes(sku)) return [{ art: 'coins', text: fmtNum(P.coins) + ' coins' }];
  if (P.bank) return [{ art: 'coins', text: 'Every coin the bank holds' }];
  const B = bundleParts(sku), out = [];
  if (B.coins) out.push({ art: 'coins', text: fmtNum(B.coins) + ' coins' });
  const many = (ids, one, lots, art, name) => {
    if (ids.length === 1) out.push({ art: art(ids[0]), text: one(ids[0]) });
    else if (ids.length) out.push({ art: art(ids[0]), text: lots(ids.length), grid: ids.map((id) => ({ art: art(id), name: name(id) })) });
  };
  many(B.hens, (id) => HEN_SKINS[id].name + ' outfit', (n) => n + ' hen outfits', (id) => 'hen:' + id, (id) => HEN_SKINS[id].name);
  many(B.eggs, (id) => SKINS[id].name + ' egg', (n) => n + ' egg skins', (id) => 'egg:' + id, (id) => SKINS[id].name);
  many(B.chicks, (id) => STRIKE_NAME(id), (n) => n + ' power chicks', (id) => 'chick:' + id, STRIKE_NAME);
  if (B.charges) out.push({ art: 'charge', text: B.charges + ' Chick Charges' });
  if (B.boosts) out.push({ art: 'boosts', text: `${B.boosts} of every boost (${B.boosts * BOOSTER_ORDER.length} in all)` });
  if (B.ally) out.push({ art: 'ally', text: B.ally + ' Ally Tickets' });
  if (B.premium) out.push({ art: 'bonus', text: 'Every bonus, instantly' }, { art: 'levels', text: `All ${levels} levels open` });
  if (B.daily) out.push({ art: 'daily', text: `${B.daily} free Chick Charge every day` });
  return out;
}
// the honest value line under the list: what the parts cost in coins, against what the same money buys as plain coins
export function iapValueLine(sku, price) {
  const k = bundleTimes(sku);
  return k >= 2 ? `Worth ${fmtNum(bundleValue(sku))} coins: ${k}x what ${price} buys as plain coins` : '';
}
export const drawIapBanner = (ctx, sku, cx, cy, bw, bh, t, wallet) => drawBanner(ctx, sku, cx, cy, bw, bh, t, wallet);

// one plain promise under a bundle's name (0.8.9: what it is for, in words a child reads)
export const PROMISE = { starter_nest: 'A head start: coins, an outfit and boosts', eggscape_premium: 'Everything. Forever.', eggscape_collector: 'Every outfit, every egg, every chick', bundle_helper: 'Coins, charges and boosts for a tricky level' };
// a bundle as a tall card: the art across the top (tag pill left, value badge right), the name, the strip, the price.
// hero: the gold frame and the bigger art (Unlock Everything)
function drawBundleTall(ui, ctx, sku, x, y, w, h, s, t, st, o = {}) {
  const P = IAP[sku], lip = 4 * s, fh = h - lip, p = 10 * s, fl = flashOf(st, 'iap:' + sku), fa = fl < 0.9 ? 1 - fl / 0.9 : 0;
  const gold = o.hero ? { wa: '#fff1a8', wb: '#ffc83a', wc: '#c98a10', glow: '#ffe27a', glowA: Math.max(fa, ui.calm ? 0 : 0.25 + 0.15 * Math.sin(t * 2.2)) } : { glow: '#ffe27a', glowA: fa };
  ui.frame(x, y, w, fh, { s, r: 18 * s, fw: (o.hero ? 6 : 4.5) * s, lip, record: true, tag: 'panel:card:' + sku, ...gold });
  ui.buttons.push({ id: 'tile:iap:' + sku, x, y, w, h: fh }); // 0.8.9: a tap anywhere on the card shows what is inside first (its sheet pays)
  const bw = w - 2 * p, bh = o.artH, bx = x + p, by = y + p;
  ui.well(bx, by, bw, bh, { s, r: 13 * s, a: o.hero ? '#ffe9a8' : '#cfe9fb', b: o.hero ? '#fff7d8' : '#eaf6ff', shade: 'rgba(20,70,130,0.25)', border: 'rgba(60,90,130,0.5)' });
  ui.record({ x: bx, y: by, w: bw, h: bh }, 'store:icon:' + sku);
  if (o.hero && !ui.calm) { // soft rays behind the hero's art
    ctx.save(); ui.roundRect(bx, by, bw, bh, 13 * s); ctx.clip(); ctx.translate(bx + bw / 2, by + bh * 0.62); ctx.rotate(t * 0.15);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; ctx.moveTo(0, 0); ctx.arc(0, 0, bw, a, a + 0.22); }
    ctx.fill(); ctx.restore();
  }
  const bounce = fl < 0.6 ? 1 + 0.18 * Math.sin((fl / 0.6) * Math.PI) : 1;
  drawBanner(ctx, sku, bx + bw / 2, by + bh / 2, bw, bh, t, st.wallet, bounce);
  if (o.tag) pill(ui, ctx, o.tag, bx + 6 * s, by + 6 * s, 12.5 * s, '#e8402e', 'store:tag:' + sku, s, 'store:icon:' + sku);
  const vr = Math.min(30 * s, bh * 0.3);
  valueBadge(ui, ctx, bundleTimes(sku), bx + bw - vr - 5 * s, by + vr + 5 * s, vr, s, t, 'store:value:' + sku, 'store:icon:' + sku);
  let cy = by + bh + 6 * s;
  const nameS = (o.hero ? 21 : 18) * s;
  ui.text(P.name, x + w / 2, cy + nameS * 0.6, { size: nameS, align: 'center', maxW: bw, color: C.ink, tag: 'store:name:' + sku });
  cy += nameS * 1.25;
  if (PROMISE[sku]) { ui.text(PROMISE[sku], x + w / 2, cy + 7.5 * s, { size: 13.5 * s, align: 'center', maxW: bw, color: C.ink2, tag: 'store:promise:' + sku }); cy += 19 * s; }
  const btnH = (o.hero ? 50 : 44) * s, room = y + fh - p - btnH - 8 * s - cy, L = stripLayout(partsOf(sku).length, bw, room, s);
  drawStrip(ui, ctx, partsOf(sku), bx, cy + Math.max(0, (room - L.h) / 2), bw, room, s, t, sku); // a shorter strip sits centred (side by side the cards share one height)
  ui.button('tile:iap:' + sku, st.price(sku), bx + bw * 0.08, y + fh - p - btnH, bw * 0.84, btnH, { kind: o.hero ? 'gold' : 'primary', size: (o.hero ? 22 : 19) * s, shimmer: !!o.hero });
}
// the height a tall bundle card needs for its art height, promise, strip and button at width w
function bundleTallH(sku, w, artH, s, hero) {
  const L = stripLayout(partsOf(sku).length, w - 20 * s, 200 * s, s);
  return 10 * s + artH + 6 * s + (hero ? 21 : 18) * s * 1.25 + (PROMISE[sku] ? 19 * s : 0) + L.h + 8 * s + (hero ? 50 : 44) * s + 10 * s + 4 * s;
}

// a bundle as a wide card: the art square on the left, the name, the strip and the price on the right
function drawBundleWide(ui, ctx, sku, x, y, w, h, s, t, st, o = {}) {
  const P = IAP[sku], lip = 4 * s, fh = h - lip, p = 10 * s, fl = flashOf(st, 'iap:' + sku), fa = fl < 0.9 ? 1 - fl / 0.9 : 0;
  ui.frame(x, y, w, fh, { s, r: 16 * s, fw: 4.5 * s, lip, glow: '#ffe27a', glowA: fa, record: true, tag: 'panel:card:' + sku });
  const a = fh - 2 * p, ax = x + p, ay = y + p;
  ui.well(ax, ay, a, a, { s, r: 12 * s, a: '#cfe9fb', b: '#eaf6ff', shade: 'rgba(20,70,130,0.28)', border: 'rgba(60,90,130,0.55)' });
  ui.record({ x: ax, y: ay, w: a, h: a }, 'store:icon:' + sku);
  ui.buttons.push({ id: 'tile:iap:' + sku, x: ax, y: ay, w: a, h: a });
  const bounce = fl < 0.6 ? 1 + 0.18 * Math.sin((fl / 0.6) * Math.PI) : 1;
  drawIapArt(ctx, sku, ax + a / 2, ay + a / 2, a * 0.98 * bounce, t, st.wallet);
  const vr = Math.min(24 * s, a * 0.2);
  valueBadge(ui, ctx, bundleTimes(sku), ax + vr + 2 * s, ay + vr + 2 * s, vr, s, t, 'store:value:' + sku, 'store:icon:' + sku);
  if (o.tag) pill(ui, ctx, o.tag, ax + 4 * s, ay + a - 22 * s, 11.5 * s, '#2f8f2a', 'store:tag:' + sku, s, 'store:icon:' + sku);
  const tx = ax + a + 10 * s, tw = x + w - p - 2 * s - tx, btnH = 42 * s, nameS = 17.5 * s;
  ui.text(P.name, tx + tw / 2, ay + nameS * 0.6, { size: nameS, align: 'center', maxW: tw, color: C.ink, tag: 'store:name:' + sku });
  const sy = ay + nameS * 1.3, room = ay + a - btnH - 6 * s - sy;
  const L = stripLayout(partsOf(sku).length, tw, room, s);
  drawStrip(ui, ctx, partsOf(sku), tx, sy + Math.max(0, (room - L.h) / 2), tw, room, s, t, sku);
  ui.button('tile:iap:' + sku, st.price(sku), tx, ay + a - btnH, tw, btnH, { kind: 'primary', size: 19 * s });
}

// a one-time bundle the player owns: a slim "Yours" row at the end of the section
function drawOwnedRow(ui, ctx, sku, x, y, w, h, s, t, st) {
  ui.frame(x, y, w, h - 3 * s, { s, r: 14 * s, fw: 3.5 * s, lip: 3 * s, record: true, tag: 'panel:card:' + sku, ca: '#f2f8ea', cb: '#e2efd2' });
  const a = h - 3 * s - 10 * s;
  drawIapArt(ctx, sku, x + 8 * s + a / 2, y + 5 * s + a / 2, a, t, st.wallet);
  ui.record({ x: x + 8 * s, y: y + 5 * s, w: a, h: a }, 'store:icon:' + sku);
  const cy = y + (h - 3 * s) / 2, yw = 86 * s;
  ui.text(IAP[sku].name, x + a + 18 * s, cy, { size: 16 * s, maxW: w - a - yw - 30 * s, color: C.ink, tag: 'store:name:' + sku });
  ui.button('owned:' + sku, 'Yours', x + w - yw - 8 * s, cy - 15 * s, yw, 30 * s, { kind: 'tertiary', disabled: true, keepFace: true, dim: 1, icon: ICON.check, size: 14 * s });
}

// TODAY'S DEAL: one coin item at 30% off for the day (economy dailyDeal). The ribbon, the art big, the name, the normal
// price struck through beside the deal price, "30% off today", one coin button. No clock: once bought it says "Got it!
// New deal tomorrow". A tap on the art (or anywhere off the button) opens the item's own sheet, at the same deal price.
function drawDeal(ui, ctx, D, x, y, w, h, s, t, st) {
  const it = storeItem(D.key, st), lip = 4 * s, fh = h - lip, p = 10 * s, fl = flashOf(st, 'deal'), fa = fl < 0.9 ? 1 - fl / 0.9 : 0;
  if (!it) return;
  ui.frame(x, y, w, fh, { s, r: 16 * s, fw: 5 * s, lip, record: true, tag: 'panel:card:deal', wa: '#fff1a8', wb: '#ffc83a', wc: '#c98a10', glow: '#ffe27a', glowA: fa });
  if (!D.done) ui.buttons.push({ id: 'tile:' + D.key, x, y, w, h: fh });
  const a = fh - 2 * p, ax = x + p, ay = y + p;
  ui.well(ax, ay, a, a, { s, r: 12 * s, a: '#ffe9a8', b: '#fff7d8', shade: 'rgba(120,70,0,0.25)', border: 'rgba(150,100,20,0.5)' });
  ui.record({ x: ax, y: ay, w: a, h: a }, 'store:icon:deal');
  const bounce = fl < 0.6 ? 1 + 0.2 * Math.sin((fl / 0.6) * Math.PI) : 1;
  it.icon(ctx, ax + a / 2, ay + a / 2 + 4 * s, a * 0.92, t, bounce);
  pill(ui, ctx, "TODAY'S DEAL", ax + 4 * s, ay + 4 * s, 11.5 * s, '#e8402e', 'store:tag:deal', s, 'store:icon:deal');
  const tx = ax + a + 12 * s, tw = x + w - p - 2 * s - tx, nameS = 18 * s;
  if (D.done) { // bought today
    ui.text(it.name, tx + tw / 2, y + fh * 0.32, { size: nameS, align: 'center', maxW: tw, color: C.ink, tag: 'store:name:deal' });
    ui.text('Got it!', tx + tw / 2, y + fh * 0.55, { size: 17 * s, align: 'center', maxW: tw, color: C.good, tag: 'store:dealgot' });
    ui.text('New deal tomorrow', tx + tw / 2, y + fh * 0.74, { size: 14 * s, align: 'center', maxW: tw, color: C.ink2, tag: 'store:dealnext' });
    return;
  }
  let cy = ay + 2 * s;
  ui.text(it.name, tx + tw / 2, cy + nameS * 0.6, { size: nameS, align: 'center', maxW: tw, color: C.ink, tag: 'store:name:deal' }); cy += nameS * 1.3;
  // the normal price, struck through, then the deal price, both with a coin
  const ps = 17 * s, wasS = String(D.was), nowS = String(D.price), ww = ui.measure(wasS, ps * 0.85), nw = ui.measure(nowS, ps * 1.15), cr = ps * 0.5, gap = 12 * s;
  const tot = cr * 2 + 4 * s + ww + gap + cr * 2 + 4 * s + nw; let px = tx + tw / 2 - tot / 2; const py = cy + ps * 0.6;
  drawCoin(ctx, px + cr, py, cr * 0.85, t); px += cr * 2 + 4 * s;
  ui.text(wasS, px, py, { size: ps * 0.85, color: 'rgba(110,70,30,0.75)', tag: 'store:dealwas' });
  ctx.strokeStyle = '#e8402e'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.moveTo(px - 2 * s, py + 3 * s); ctx.lineTo(px + ww + 2 * s, py - 3 * s); ctx.stroke(); px += ww + gap;
  drawCoin(ctx, px + cr, py, cr, t); px += cr * 2 + 4 * s;
  ui.num(nowS, px, py, { size: ps * 1.15, tag: 'store:dealnow' }); cy += ps * 1.45;
  ui.text(OFF_TAG + ' today', tx + tw / 2, cy + 7 * s, { size: 13.5 * s, align: 'center', maxW: tw, color: '#c0392b', tag: 'store:dealoff' });
  const bh = 42 * s, ok = st.wallet.coins >= D.price;
  ui.button('deal:buy', nowS, tx, ay + a - bh, tw, bh, { kind: ok ? 'primary' : 'off', icon: coinIcon(t), size: 19 * s, shimmer: ok && !ui.calm });
}

// FREE TODAY: the daily gift, a free sample (or a free boost for a video), free coins for a video. Tiles that act on a tap.
function freeTiles(st, state) {
  const w = st.wallet, day = state.day || '', S = sampleFor(w, day), cd = state.adCooldownLeft || 0, prem = !!w.noAds, adOff = !prem && (cd > 0 || !state.adReady);
  // Unlock Everything: the "video" tiles pay at once (ads.rewarded), so they carry no film badge
  const DONE = { label: 'Tomorrow', keepFace: true, disabled: true };
  return [
    { key: 'free:daily', name: 'Daily gift', hue: '#ffc74a', tap: 'home:chest', flash: flashOf(st, 'free:daily'),
      icon: (c, cx, cy, it, tt, b) => drawChest(c, cx, cy + it * 0.08, it * 0.72 * b, tt, state.dailyOpen ? 'open' : 'ready'),
      btn: state.dailyOpen ? DONE : { label: 'Open', kind: 'primary' } },
    { key: 'free:sample', name: S.video ? 'Free boost' : 'Free sample', hue: BOOST_HUE[S.id] || '#9be37a', tap: 'sample', flash: flashOf(st, 'free:sample'),
      icon: (c, cx, cy, it, tt, b) => drawBoosterIcon(c, S.id, cx, cy, it * 0.7 * b, tt),
      btn: S.done ? DONE : S.video && !prem ? { label: 'Free', kind: 'ad', ad: true } : { label: 'Free', kind: 'primary' } },
    { key: 'free:coins', name: 'Free coins', hue: '#c7a0ff', tap: 'ad:coins', flash: state.flash && state.flash.id === 'ad' ? state.flash.t : 99, num: '+' + AD_NOW,
      icon: (c, cx, cy, it, tt, b) => coinPile(c, cx, cy - it * 0.06, it * 0.86 * b, 3, tt),
      btn: cd >= 3600 ? DONE : cd > 0 ? { label: fmtTime(cd), kind: 'off', disabled: true } : prem ? { label: 'Free', kind: 'primary' } : { label: adOff ? 'Soon' : 'Free', kind: adOff ? 'off' : 'ad', ad: !adOff, disabled: adOff } },
  ];
}

// coin bundles: a kit of boosts, a set of hen + egg
function kitItem(id, st) {
  const K = KITS[id], w = st.wallet, price = kitPrice(id), full = kitFull(w, id), ok = !full && w.coins >= price;
  const names = K.parts.map((b) => BOOSTERS[b].name);
  return withDeal({
    key: 'kit:' + id, name: K.name, parts: K.parts.map((b) => ({ art: 'boost:' + b, text: '1 ' + BOOSTERS[b].name })), flash: flashOf(st, 'kit:' + id), hue: id === 'toolbox' ? '#ffd36a' : id === 'time' ? '#ffb38a' : '#a8d8ff',
    line: K.parts.length === BOOSTER_ORDER.length ? 'One of every boost.' : names.join(', ') + '.',
    badge: 'Save ' + kitSave(id), badgeCol: '#2f8f2a',
    icon: (ctx, cx, cy, it, t, bounce) => kitArt(ctx, K.parts, cx, cy, it * bounce, t),
    btn: { id: 'kit:' + id, label: full ? 'Full' : String(price), disabled: full, coin: !full, ...(ok ? GREEN : GREY) },
    sub: { text: `${K.parts.length} boosts, ${Math.round(K.off * 100)}% off`, color: C.good },
  }, st);
}
function kitArt(ctx, parts, cx, cy, it, t) {
  if (parts.length <= 3) { const P = [[-0.2, 0.12], [0.2, 0.12], [0, -0.14]]; parts.forEach((b, i) => drawBoosterIcon(ctx, b, cx + P[i][0] * it, cy + P[i][1] * it, it * 0.44, t)); return; }
  parts.forEach((b, i) => { const r = i < 4 ? 0 : 1, k = r ? i - 4 : i, n = r ? 3 : 4; drawBoosterIcon(ctx, b, cx + (k - (n - 1) / 2) * it * 0.24, cy + (r ? 0.16 : -0.12) * it, it * 0.3, t); });
}
function setItem(id, st) {
  const S = SETS[id], w = st.wallet, price = setPrice(w, id), ok = w.coins >= price;
  return withDeal({
    key: 'set:' + id, name: S.name + ' set', parts: [{ art: 'hen:' + S.hen, text: HEN_SKINS[S.hen].name + ' outfit' }, { art: 'egg:' + S.egg, text: SKINS[S.egg].name + ' egg' }], flash: flashOf(st, 'set:' + id), hue: { winter: '#bfe3ff', explorer: '#ffd08a', crystal: '#d4b8ff', storm: '#ffe680' }[id],
    line: `The ${HEN_SKINS[S.hen].name} and the ${SKINS[S.egg].name} egg, worn together.`,
    badge: 'Save ' + setSave(w, id), badgeCol: '#2f8f2a',
    icon: (ctx, cx, cy, it, t, bounce) => { drawHenSkinPreview(ctx, S.hen, cx - it * 0.1, cy + it * 0.02, it * 0.8 * bounce, t); drawSkinPreview(ctx, S.egg, cx + it * 0.26, cy + it * 0.2, it * 0.36 * bounce, t); },
    btn: { id: 'hset:' + id, label: String(price), coin: true, ...(ok ? GREEN : GREY) },
    sub: { text: 'Hen + egg, 25% off', color: C.good },
  }, st);
}

// ---- icon tiles (2026-11-16, owner: "every item as a curvy, colourful icon tile with the price at the bottom; tap shows
// the description"). Power-ups, Hens and Eggs are grids of rounded tiles; a tap opens the detail sheet (the game draws
// it from storeItem(key)). Each tile: its own colour, the art big, the name, and a chip at the bottom: the price (coins
// or money), or Owned / Equipped / Yours.
const TILE_HUES = ['#7fc3ff', '#ff9f8a', '#9be37a', '#ffd36a', '#c7a0ff', '#7fe0c4', '#ffb3d9', '#f5b38a'];
const BOOST_HUE = { stone: '#aab4be', golden: '#ffd24a', time: '#ff9f5a', rewind: '#7fb3ff', sponge: '#f2e06a', nest: '#e0b878', snips: '#9fdc8a' };
const ITEM_HUE = { ally: '#ff8a72', goldhour: '#ffc74a', skip: '#8ac4ff' };

const perkFit = (ui, line, room, s) => fitWrap(ui, line, room, 2, 10.5 * s, 8.5 * s);
function drawTile(ui, ctx, item, x, y, w, h, s, t) {
  // item.tap: the tile acts at once (the FREE TODAY row) instead of opening the detail sheet; item.trying: worn on trial
  const lip = 5 * s, fh = h - lip, r = 18 * s, col = item.hue || '#7fc3ff', B = item.trying ? { label: 'Trying', kind: 'secondary' } : item.btn;
  const fl = item.flash < 0.9 ? 1 - item.flash / 0.9 : 0;
  if (fl > 0.01) { ui.roundRect(x - 4 * s, y - 4 * s, w + 8 * s, h + 8 * s, r + 4 * s); ctx.fillStyle = `rgba(255,226,122,${0.85 * fl})`; ctx.fill(); }
  ui.roundRect(x, y + lip, w, fh, r); ctx.fillStyle = tint(col, -0.42); ctx.fill(); // the lip
  ui.roundRect(x, y, w, fh, r);
  const g = ctx.createLinearGradient(0, y, 0, y + fh); g.addColorStop(0, tint(col, 0.6)); g.addColorStop(1, tint(col, 0.12));
  ctx.fillStyle = g; ctx.fill();
  const on = B.keepFace && B.label === 'Equipped';
  ctx.lineWidth = (on ? 4 : 2.5) * s; ctx.strokeStyle = on ? '#ffc83a' : tint(col, -0.5); ctx.stroke();
  // a soft light behind the art
  const pkH = item.pkH != null ? item.pkH * s : item.perk ? 21 * s : 0; // an egg skin's power: its own pill under the name (item.pkH: the grid's one pill room, 0.8.16)
  const chipH = 26 * s, nameS = 13 * s, top = item.why ? 30 * s : item.badgeCol ? 18 * s : 0, ah = fh - chipH - nameS * 1.3 - 16 * s - top - pkH, acx = x + w / 2, acy = y + 6 * s + top + ah / 2; // a Save pill gets its own room above the art
  const lg = ctx.createRadialGradient(acx, acy, 0, acx, acy, Math.min(w, ah) * 0.55); lg.addColorStop(0, 'rgba(255,255,255,0.75)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lg; ctx.fillRect(x, y, w, ah + 12 * s);
  const bounce = item.flash < 0.6 ? 1 + 0.2 * Math.sin((item.flash / 0.6) * Math.PI) : 1;
  item.icon(ctx, acx, acy, Math.min(w * 0.86, ah * 1.06), t, bounce);
  ui.record({ x: acx - Math.min(w * 0.86, ah) / 2, y: acy - ah / 2, w: Math.min(w * 0.86, ah), h: ah }, 'store:tart:' + item.key);
  const nm = item.short || item.name, nmw = ui.measure(nm, nameS), nmMax = w - 7 * s; // (0.8.14: "Snowy Owl Look" keeps the size of its neighbours; only a longer name still shrinks) shrink a long name to fit whole ("Snowy Owl Look" at 360 px) rather than cut it
  ui.text(nm, x + w / 2, y + 6 * s + top + ah + 4 * s + nameS * 0.6, { size: nmw > nmMax ? Math.floor(nameS * nmMax / nmw * 0.97) : nameS, align: 'center', maxW: nmMax, color: tint(col, -0.72), tag: 'store:tname:' + item.key });
  if (item.perk) { // the egg skin's power: its icon and at most four words
    // 0.8.16 (mykee: "maintain font consistency"): every power is written at one size; a line too long for the tile
    // takes a second line instead of shrinking (it used to go down to 7 units, a different size on every tile)
    const ic = 19 * s, room = w - 8 * s - ic - 10 * s, F = perkFit(ui, item.perk.line, room, s), lh = F.size * 1.12;
    const ph = Math.max(ic, F.lines.length * lh + 6 * s), slot = Math.max(ph, pkH - 2 * s), py = y + 6 * s + top + ah + 4 * s + nameS * 1.3 + (slot - ph) / 2;
    const pw2 = Math.min(w - 8 * s, ic + Math.max(...F.lines.map((l) => ui.measure(l, F.size))) + 10 * s), px2 = x + (w - pw2) / 2;
    ui.roundRect(px2, py, pw2, ph, Math.min(ph / 2, 11 * s)); ctx.fillStyle = 'rgba(70,40,110,0.9)'; ctx.fill();
    pictoPerk(ctx, item.perk.icon, px2 + ic / 2 + 1 * s, py + ph / 2, ic * 0.76, t);
    F.lines.forEach((ln, i) => ui.text(ln, px2 + ic + 1 * s, py + ph / 2 + (i - (F.lines.length - 1) / 2) * lh, { size: F.size, color: '#fff', maxW: pw2 - ic - 8 * s, tag: 'store:perk:' + item.key + (i ? ':' + i : ''), group: 'store:tart:' + item.key }));
  }
  if (item.why) { // FOR YOU: why this one, on a small ribbon across the top of the tile
    const F = fitWrap(ui, item.why, w - 26 * s, 2, 11.5 * s, 9.5 * s), lh = F.size * 1.12, rh = Math.max(18 * s, F.lines.length * lh + 5 * s), ry = y + 6 * s;
    ctx.fillStyle = '#7a48e8'; ctx.beginPath(); ctx.moveTo(x + 4 * s, ry); ctx.lineTo(x + w - 4 * s, ry); ctx.lineTo(x + w - 10 * s, ry + rh / 2); ctx.lineTo(x + w - 4 * s, ry + rh); ctx.lineTo(x + 4 * s, ry + rh); ctx.lineTo(x + 10 * s, ry + rh / 2); ctx.closePath(); ctx.fill();
    F.lines.forEach((ln, i) => ui.text(ln, x + w / 2, ry + rh / 2 + (i - (F.lines.length - 1) / 2) * lh + 0.5 * s, { size: F.size, align: 'center', color: '#fff', maxW: w - 24 * s, tag: `store:why:${item.key}:${i}` }));
  } else if (item.badge) pill(ui, ctx, item.badge, x + 7 * s, y + 7 * s, 11.5 * s, item.badgeCol || '#5b3413', 'store:badge:' + item.key, s, 'store:tart:' + item.key); // e.g. the level a chick comes free, a kit's saving
  if (item.num) ui.num(item.num, acx, acy + ah * 0.32, { size: 19 * s, align: 'center', maxW: w - 16 * s, tag: 'store:tnum:' + item.key, group: 'store:tart:' + item.key }); // what the free video pays
  if (item.premium) { ui.roundRect(x + 3 * s, y + 3 * s, w - 6 * s, fh - 6 * s, r - 3 * s); ctx.lineWidth = 2.5 * s; ctx.strokeStyle = '#ffc928'; ctx.stroke(); } // a premium chick: a gold inner rim (its token wears the crown)
  // the chip
  const cx0 = x + 8 * s, cy0 = y + fh - 8 * s - chipH, cwid = w - 16 * s;
  const coinChip = !!B.coin, ok = B.kind === 'primary' || B.kind === 'gold' || B.kind === 'secondary';
  const fill = B.keepFace ? '#fffaf0' : B.disabled ? '#b8ad9e' : coinChip ? (ok ? '#3eb42d' : '#a09383') : B.kind === 'gold' ? '#f6a21b' : B.kind === 'secondary' ? '#3a80ea' : B.kind === 'ad' ? '#7a48e8' : B.kind === 'off' ? '#a09383' : '#3eb42d';
  ui.roundRect(cx0, cy0, cwid, chipH, chipH / 2); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 1.5 * s; ctx.strokeStyle = B.keepFace ? 'rgba(47,143,42,0.6)' : 'rgba(30,15,5,0.45)'; ctx.stroke();
  const ls = 14.5 * s, lw = ui.measure(B.label, ls), icoW = coinChip || B.keepFace ? ls * 1.15 : B.ad ? ls * 1.45 : 0;
  // a half-price ticket in hand: the old price, small and struck through, stands before the new one
  const TK = item.ticket && coinChip && !item.trying ? item.ticket : null, ws = ls * 0.8, wasW = TK ? ui.measure(String(TK.was), ws) + 7 * s : 0, tx = x + w / 2 - (lw + icoW + wasW) / 2 + wasW;
  if (TK) {
    const wx = tx - wasW, wy = cy0 + chipH / 2 + 0.5 * s;
    ui.text(String(TK.was), wx, wy, { size: ws, color: 'rgba(255,255,255,0.82)', tag: 'store:was:' + item.key, group: 'store:chip:' + item.key });
    ctx.save(); ctx.strokeStyle = '#ff5a48'; ctx.lineWidth = 2.2 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(wx - 1.5 * s, wy + ws * 0.2); ctx.lineTo(wx + wasW - 5.5 * s, wy - ws * 0.2); ctx.stroke(); ctx.restore();
    const tg = '-50%', ts = 10.5 * s, pw = ui.measure(tg, ts) + 12 * s, ph = ts * 1.7, px = x + w - pw - 5 * s, py = y + 5 * s; // the tag sits in the tile's corner, the art keeps its size
    ui.roundRect(px, py, pw, ph, ph / 2); ctx.fillStyle = TICKET_COL; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = 'rgba(40,15,80,0.7)'; ctx.stroke();
    ui.text(tg, px + pw / 2, py + ph / 2 + 0.5 * s, { size: ts, align: 'center', color: '#fff', tag: 'store:off:' + item.key, group: 'store:tart:' + item.key });
  }
  if (coinChip) drawCoin(ctx, tx + ls * 0.5, cy0 + chipH / 2, ls * 0.5, t);
  else if (B.ad) drawAdBadge(ctx, tx, cy0 + chipH / 2, ls * 1.2, ls * 0.86); // a video: the same film badge as every ad button
  else if (B.keepFace) { ctx.strokeStyle = C.good; ctx.lineWidth = 2.5 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(tx + ls * 0.1, cy0 + chipH / 2); ctx.lineTo(tx + ls * 0.38, cy0 + chipH / 2 + ls * 0.28); ctx.lineTo(tx + ls * 0.85, cy0 + chipH / 2 - ls * 0.3); ctx.stroke(); }
  ui.text(B.label, tx + icoW + lw / 2, cy0 + chipH / 2 + 0.5 * s, { size: ls, align: 'center', maxW: cwid - icoW - wasW - 8 * s, color: B.keepFace ? C.good : '#fff', stroke: B.keepFace ? null : 'rgba(30,15,5,0.55)', strokeW: 3 * s, tag: 'store:chip:' + item.key });
  if (item.count > 0) { // how many the player holds
    const br = 11 * s, bx = x + w - br - 5 * s, by = y + br + 5 * s;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fillStyle = '#e8402e'; ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = '#5a110a'; ctx.stroke();
    ui.text(String(item.count), bx, by + 0.5 * s, { size: 13 * s, align: 'center', maxW: br * 1.7, color: '#fff', tag: 'store:count:' + item.key, group: 'store:tart:' + item.key });
  }
  if (!(item.tap && B.disabled)) ui.buttons.push({ id: item.tap || 'tile:' + item.key, x, y, w, h });
  return { x: cx0, y: cy0, w: cwid, h: chipH }; // the chip: where the pointer of a wanted tile taps (ui/focus.js)
}

// one item by its key (the detail sheet asks for it): 'stone', 'item:ally', 'charge:chick3', 'chick:thunder', 'hen:elf',
// 'skin:dino', 'iap:starter_nest', 'kit:rescue', 'set:winter'. st: { wallet, t, flash, price(sku), reach }
export function storeItem(key, st0) {
  const st = { price: usdHint, reach: 1, t: 0, ...st0 };
  if (st.deal === undefined) st.deal = st.day && st.wallet ? dailyDeal(st.wallet, st.day) : null;
  const [kind, id] = key.includes(':') ? [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)] : ['boost', key];
  if (kind === 'boost' && (BOOSTERS[key] || BOOSTERS[id])) return boosterItem(BOOSTERS[key] ? key : id, st); // 'stone' or 'boost:stone'
  if (kind === 'item' && ITEMS[id]) return coinItemCard(id, st);
  if (kind === 'charge') { const P = CHARGE_PACKS.find((q) => q.id === id); return P ? chargeItem(P, st) : null; }
  if (kind === 'chick') { const S = STRIKES.find((q) => q.id === id); return S ? chickItem(S, st) : null; }
  if (kind === 'hen' && HEN_SKINS[id]) return henItem(id, st);
  if (kind === 'skin' && SKINS[id]) return skinItem(id, st);
  if (kind === 'iap' && IAP[id]) return iapItem(id, st);
  if (kind === 'kit' && KITS[id]) return kitItem(id, st);
  if (kind === 'set' && SETS[id]) return setItem(id, st);
  return null;
}
// the tile's colour and count badge for an item
function tileLook(item, i) {
  const k = item.key, id = k.slice(k.indexOf(':') + 1);
  if (BOOST_HUE[k]) item.hue = BOOST_HUE[k];
  else if (k.startsWith('item:')) item.hue = ITEM_HUE[id];
  else if (k.startsWith('charge:')) item.hue = '#8fd8ff';
  else if (k.startsWith('chick:')) { const S = STRIKES.find((q) => q.id === id); item.hue = S && S.col ? S.col[0] : '#ffd36a'; }
  else if (item.hue) return item; // kits, sets and the free tiles bring their own
  else if (k.startsWith('iap:')) item.hue = '#d7b0ff';
  else if (k.startsWith('go:')) item.hue = ['#ffd36a', '#ff9f8a', '#9be37a'][i % 3];
  else item.hue = TILE_HUES[i % TILE_HUES.length];
  return item;
}

// The shop's tabs: Deals | Power-ups | Hens | Eggs.
// 2026-11-20 shop 2.0: Deals became Featured (free things first, three bundles, coin packs last); the id stays 'deals'
export const STORE_TABS = [['deals', 'Featured'], ['boosters', 'Power-ups'], ['hens', 'Hens'], ['skins', 'Eggs']];
// on the web (no real money) the first tab is the free things: the daily gift, a free sample, free coins for a video
const WEB_TABS = [['deals', 'Free'], ['boosters', 'Power-ups'], ['hens', 'Hens'], ['skins', 'Eggs']];

// state: { area, wallet, t, adReady, adCooldownLeft, flash, tab, scroll (also .want: 'coins' | 'bank' jumps there once),
//   dragging, price(sku), featured: { sku } | null, reach (furthest level, for the power chicks), money (real-money
//   products shown: the app; false on web portals), dailyOpen (the daily chest was opened today) }
export function drawStore(ui, ctx, W, H, state) {
  const { wallet, t = 0, adReady = false, adCooldownLeft = 0, flash = null } = state;
  AD_NOW = state.adCoins || AD_REWARDS.freeCoins.coins;
  const money = state.money !== false, TABS = money ? STORE_TABS : WEB_TABS;
  const tab = TABS.some(([id]) => id === state.tab) ? state.tab : 'deals';
  const st = { wallet, t, flash, price: state.price || usdHint, reach: state.reach || 1, money, trial: state.trial, day: state.day || '' };
  st.deal = st.day ? dailyDeal(wallet, st.day) : null; // TODAY'S DEAL: its card, and the same price on the item's own tile
  // the room paints edge to edge (W x H); everything in it lays out in the safe rect (state.area, else the whole screen)
  const AR = state.area || { x: 0, y: 0, w: W, h: H }, OX = AR.x, OY = AR.y, AW = AR.w, AH = AR.h;
  const { cols, s } = planLayout(AW, AH, ui.u);
  // 0.8.14: one content column for the header, the tabs and every row (ui.pageBox: the same side margin as the level card)
  const gap = D.gap * s, pad = ui.pageBox(Infinity, AR).pad;
  const cw = cols === 1 ? Math.min(AW - 2 * pad, 520 * s) : Math.min(AW - 2 * pad, 2 * 440 * s + gap);
  const P = ui.pageBox(cw, AR);

  // the shop's own room: deep violet, a soft light from above, slow rays (still when reduced motion is on)
  if (!themeBack(ctx, ui.skin, W, H, H * 0.8, true)) { // a skin pack paints its own room (ui/theme.js)
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

  // ---- header (0.8.14: the one page header, ui.pageHeader): back and home on the left, the Shop ribbon in the middle of
  // the screen, the balance on the right (the same gold coin button as the level card; its "+" opens the coin packs)
  const coinFl = flash && (flash.id === 'coins' || flash.id === 'ad') && flash.t < 0.9 ? 1 - flash.t / 0.9 : 0;
  // the balance rolls to its new value (a purchase counts down, an ad reward counts up)
  if (state.balHold != null) BAL.v = state.balHold; // a purchase reveal: the balance waits for its coins to land
  else if (BAL.v == null || ui.calm || Math.abs(wallet.coins - BAL.v) > 5000) BAL.v = wallet.coins;
  else if (BAL.v !== wallet.coins) { const d = wallet.coins - BAL.v; BAL.v += Math.abs(d) < 1.5 ? d : d * 0.16; }
  const balStr = String(Math.round(BAL.v));
  const hs = P.s, balSize = 21 * hs;
  // coin, number and "+" are one group, centred in the button (as wide as its widest digits: it does not jitter while it rolls)
  const balW = ui.measure(String(wallet.coins).replace(/\d/g, '0'), balSize), cr = 11.5 * hs, pr = 9 * hs, grpW = 2 * cr + 6 * hs + balW + 7 * hs + 2 * pr;
  const coinW = Math.max(96 * hs, grpW + 24 * hs);
  ui.pageHeader(P, { back: 'back', left2: { id: 'home', icon: ICON.home }, title: 'Shop', color: '#f0a01c', tag: 'store:title', right: { w: coinW, draw: (bx, by, bw, bh) => {
    ui.button('store:coins', '', bx, by, bw, bh, { kind: 'gold', shimmer: coinFl > 0, iconS: 1, size: balSize, icon: (c, X, Y) => {
      const gx = X - grpW / 2;
      drawCoin(c, gx + cr, Y, cr * (1 + 0.15 * coinFl), t);
      ui.record({ x: gx, y: Y - cr, w: 2 * cr, h: 2 * cr }, 'store:coinicon', 'btn:store:coins'); // where the coins fly to (main.js)
      ui.text(balStr, gx + 2 * cr + 6 * hs + balW / 2, Y, { size: balSize, align: 'center', color: '#fff', stroke: '#6b3d04', strokeW: Math.max(2 * hs, balSize * 0.15), shadow: '#6b3d04', shadowD: balSize * 0.07, tag: 'store:balance', group: 'btn:store:coins' });
      const pcx = gx + grpW - pr; // the "+": the coin packs
      c.beginPath(); c.arc(pcx, Y, pr, 0, 7); c.fillStyle = '#3cb043'; c.fill(); c.lineWidth = 1.6 * hs; c.strokeStyle = '#1f6b24'; c.stroke();
      c.fillStyle = '#fff'; c.fillRect(pcx - pr * 0.5, Y - pr * 0.13, pr, pr * 0.26); c.fillRect(pcx - pr * 0.13, Y - pr * 0.5, pr * 0.26, pr);
    } });
  } } });

  // ---- tabs: the same left and right edge as the cards under them
  const tg = 6 * s, tabW = Math.min(130 * s, (cw - tg * (TABS.length - 1)) / TABS.length), tabH = (D.tabH + 2) * s;
  const tabX = OX + AW / 2 - (tabW * TABS.length + tg * (TABS.length - 1)) / 2, tabY = P.bottom + 8 * s;
  // one label size for every tab, the largest at which the longest label fits
  const tabS = Math.min(17 * s, ...TABS.map(([, l]) => (tabW - 18 * s) * 17 * s / ui.measure(l, 17 * s)));
  for (const [i, [id, label]] of TABS.entries()) {
    const on = tab === id;
    ui.button('tab:' + id, label, tabX + i * (tabW + tg), tabY, tabW, tabH, { kind: on ? 'gold' : 'hud', size: tabS });
  }

  // ---- body: one scrolling column of rows (section headings, card rows, the coin-pack grid)
  const bodyTop = tabY + tabH + 6 * s;
  const avail = OY + AH - bodyTop - pad;
  const rows = [];
  const add = (h, draw, key, before = gap) => rows.push({ h, draw, key, before });
  // 0.8.10 (mykee: the shop must open ON the item the player tapped): which row holds each card, and where each was drawn
  const SC0 = state.scroll || {}, rowOf = {}, HL = SC0.hl, hit = (key) => { rowOf[key] = rows.length; };
  let hlR = null; const mark = (key, x, y, w, h, chip) => { if (HL && HL.key === key) hlR = { x, y, w, h, chip }; }; // chip: its price button (the hand points there)
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
      R.forEach((it) => hit(it.key));
      add(rh, (x, y, w) => { const k = R.length, cwi = (w - (k - 1) * gap) / k; R.forEach((it, j) => { drawCard(ui, ctx, it, x + j * (cwi + gap), y, cwi, rh, s, t, k === 1); mark(it.key, x + j * (cwi + gap), y, cwi, rh); }); }, i ? null : key, rows.length && rows[rows.length - 1].head ? 6 * s : gap);
    }
  };

  // icon tiles: 3 to a row upright, 5-6 on a wide screen; a short last row is centred
  const tn = cols === 1 ? 3 : Math.max(4, Math.min(6, Math.floor((cw + gap) / (138 * s + gap))));
  const tiles = (items, key, n = tn) => {
    const tn = n, tw = (cw - (tn - 1) * gap) / tn;
    // 0.8.16: a power that needs two lines at the one size: every tile of this grid gets the taller pill room, and the
    // tiles grow by as much, so no egg is drawn smaller for it
    const pk2 = items.some((it) => it.perk && perkFit(ui, it.perk.line, tw - 8 * s - 19 * s - 10 * s, s).lines.length > 1), pkU = pk2 ? 32 : 21;
    const th = Math.round(Math.min(tw * (cols === 1 ? 1.22 : 1.12), 200 * s) + (pk2 ? 11 * s : 0));
    items.forEach(tileLook);
    items.forEach((it) => { it.pkH = it.perk ? pkU : pk2 ? 0 : null; });
    for (let i = 0; i < items.length; i += tn) {
      const R = items.slice(i, i + tn);
      R.forEach((it) => hit(it.key));
      add(th, (x, y, w) => { const x1 = x + (w - (R.length * tw + (R.length - 1) * gap)) / 2; R.forEach((it, j) => { const chip = drawTile(ui, ctx, it, x1 + j * (tw + gap), y, tw, th, s, t); mark(it.key, x1 + j * (tw + gap), y, tw, th, chip); }); }, i ? null : key, rows.length && rows[rows.length - 1].head ? 6 * s : gap);
    }
  };

  const freeRow = () => { head('Free today', 'free'); tiles(freeTiles(st, { ...state, adReady, adCooldownLeft })); };
  // FOR YOU (the lead's engine fills state.forYou: [{ key, why }], 0 to 3): coin tiles with a "why" ribbon; none, no row
  const forYouRow = () => {
    const L = (state.forYou || []).slice(0, 3).map((f) => { const it = f && storeItem(f.key, st); return it ? { ...it, why: f.why || '', badge: null, badgeCol: null } : null; }).filter(Boolean);
    if (L.length) { head('For you', 'foryou'); tiles(L); }
  };
  const dealRow = () => { // TODAY'S DEAL (none when nothing is left to offer)
    if (!st.deal) return;
    head("Today's deal", 'deal');
    const dh = 150 * s;
    add(dh, (x, y, w) => { const dw = Math.min(w, 520 * s); drawDeal(ui, ctx, st.deal, x + (w - dw) / 2, y, dw, dh, s, t, st); }, null, 6 * s);
  };
  if (tab === 'deals' && !money) { // web: nothing for money; the free row, then where coins go
    freeRow(); forYouRow(); dealRow();
    head('Spend your coins');
    const go = (tabId, name, chip, icon) => ({ key: 'go:' + tabId, name, line: '', flash: 99, icon, btn: { label: chip, kind: 'secondary' } });
    tiles([
      go('boosters', 'Power-ups', 'Boosts', (c, cx, cy, it, tt) => { drawBoosterIcon(c, 'golden', cx - it * 0.16, cy, it * 0.5, tt); drawStrikeToken(c, 'thunder', cx + it * 0.18, cy + it * 0.08, it * 0.2, tt, true); }),
      go('hens', 'Hens', 'Outfits', (c, cx, cy, it, tt) => drawHenSkinPreview(c, 'santa', cx, cy + it * 0.04, it * 0.84, tt)),
      go('skins', 'Eggs', 'Skins', (c, cx, cy, it, tt) => { drawSkinPreview(c, 'galaxy', cx - it * 0.16, cy, it * 0.56, tt); drawSkinPreview(c, 'dino', cx + it * 0.18, cy + it * 0.06, it * 0.5, tt); }),
    ]);
  } else if (tab === 'deals') {
    // 2026-11-20 shop 2.0 (research: Brawl Stars' free daily item, Royal Match's three-tier bundles, value badges): the shop
    // gives before it asks. FREE TODAY, then the three bundles (Unlock Everything the hero), then the repeatable Helper
    // Bundle and the bank, the coin packs last. No popups on entering.
    // 0.8.9 (mykee: "smooth and easy to understand"): one card language, in this order: FREE TODAY, FOR YOU, TODAY'S
    // DEAL, BUNDLES (the same tall card for all three, the hero gold with the page's one "Best value"), COINS, MORE
    freeRow(); forYouRow(); dealRow();
    head('Bundles', 'bundles');
    const H0 = BUNDLES.includes(state.hero) ? state.hero : PREMIUM; // the lead's engine may pick the hero and the order
    const ORD = Array.isArray(state.order) && state.order.length ? [...state.order.filter((k) => BUNDLES.includes(k)), ...BUNDLES.filter((k) => !state.order.includes(k))] : state.hero && BUNDLES.includes(state.hero) ? [H0, ...BUNDLES.filter((k) => k !== H0)] : BUNDLES;
    const forSale = ORD.filter((sku) => iapAvailable(wallet, sku)), owned = ORD.filter((sku) => !forSale.includes(sku));
    const hero = (sku) => sku === H0, tag = (sku) => (sku === H0 ? 'Best value' : null);
    if (cols === 2 && forSale.length) { // wide: the bundles side by side, the hero in the middle
      // each card's width by how much it holds (the hero's strip has the most icons)
      const wt = forSale.map((sku) => (hero(sku) ? 1.15 : sku === 'starter_nest' ? 0.8 : 1.05)), unit = (cw - (forSale.length - 1) * gap) / wt.reduce((a, b) => a + b, 0), artH = 92 * s;
      const rh = Math.max(...forSale.map((sku, j) => bundleTallH(sku, unit * wt[j], artH, s, hero(sku))));
      forSale.forEach((sku) => hit('iap:' + sku));
      add(rh, (x, y) => { let xx = x; forSale.forEach((sku, j) => { drawBundleTall(ui, ctx, sku, xx, y, unit * wt[j], rh, s, t, st, { hero: hero(sku), artH, tag: tag(sku) }); mark('iap:' + sku, xx, y, unit * wt[j], rh); xx += unit * wt[j] + gap; }); }, null, 6 * s);
    } else {
      forSale.forEach((sku, i) => {
        const artH = (hero(sku) ? 150 : 118) * s, h = bundleTallH(sku, cw, artH, s, hero(sku));
        hit('iap:' + sku);
        add(h, (x, y, w) => { drawBundleTall(ui, ctx, sku, x, y, w, h, s, t, st, { hero: hero(sku), artH, tag: tag(sku) }); mark('iap:' + sku, x, y, w, h); }, null, i ? gap : 6 * s);
      });
    }
    for (const sku of owned) add(52 * s, (x, y, w) => drawOwnedRow(ui, ctx, sku, x, y, w, 52 * s, s, t, st), null, forSale.length ? gap : 6 * s);
    head('Coins', 'coins');
    // the four coin packs: 2 x 2 upright, 4 across on a wide screen
    const pc = cols === 1 ? 2 : 4, phh = D.packH * s;
    for (let i = 0; i < COIN_PACKS.length; i += pc) {
      const R = COIN_PACKS.slice(i, i + pc);
      R.forEach((sku) => hit('iap:' + sku));
      add(phh, (x, y, w) => { const cwi = (w - (pc - 1) * gap) / pc; R.forEach((sku, j) => { drawPack(ui, ctx, sku, x + j * (cwi + gap), y, cwi, phh, s, t, st); mark('iap:' + sku, x + j * (cwi + gap), y, cwi, phh); }); }, null, i ? gap : 6 * s);
    }
    head('More', 'bank'); // the repeatable Helper Bundle (the same card as the bundles upright) and the bank
    if (cols === 1) { const artH = 118 * s, hh = bundleTallH('bundle_helper', cw, artH, s, false); add(hh, (x, y, w) => drawBundleTall(ui, ctx, 'bundle_helper', x, y, w, hh, s, t, st, { artH }), null, 6 * s); }
    else { const hh = 156 * s; add(hh, (x, y, w) => drawBundleWide(ui, ctx, 'bundle_helper', x, y, w, hh, s, t, st), null, 6 * s); }
    cards([bankItem(st)]);
  } else if (tab === 'boosters') {
    head('Kits'); // bundles for coins first: a few boosts together for less
    tiles(KIT_ORDER.map((id) => kitItem(id, st)));
    head('Boosts', 'boosts');
    tiles(BOOSTER_ORDER.map((id) => boosterItem(id, st)));
    head('Helpers');
    tiles(ITEM_ORDER.map((id) => coinItemCard(id, st)));
    head('Chick Charges');
    tiles(CHARGE_PACKS.map((P) => chargeItem(P, st)));
    head('Power chicks', 'chicks');
    tiles(STRIKES.filter((S) => !S.premium).map((S) => chickItem(S, st)));
    head('Premium chicks', 'premium'); // coins only: never in a level unlock or a chick pack
    tiles(STRIKES.filter((S) => S.premium).map((S) => chickItem(S, st)));
  } else if (tab === 'hens') {
    const sets = SET_ORDER.filter((id) => setAvailable(wallet, id));
    if (sets.length) { head('Sets', 'sets'); tiles(sets.map((id) => setItem(id, st)), null, cols === 1 ? 2 : 4); head('Outfits'); } // two big tiles a row: the pair is the picture
    tiles(HEN_SKIN_ORDER.filter((id) => money || !HEN_SKINS[id].premium).map((id) => henItem(id, st)));
  } else tiles(SKIN_ORDER.map((id) => skinItem(id, st)));

  // a long list scrolls between the tabs and the bottom; cards cut by the edge keep a tap area only inside the list and
  // record nothing for the overlap check
  const SC = state.scroll || { y: 0, v: 0, max: 0 }, vt = bodyTop - 4 * s, vb = OY + AH;
  const dt = Math.min(0.1, Math.max(0, t - (SC.t || t))); SC.t = t;
  const lim = ui.calm ? 0 : 110 * s; // 0.8.7: the one scroll feel (scroll.js): a fling glides, the ends stretch and settle
  if (!state.dragging) glideStep(SC, dt, lim);
  let total = 0;
  const at = {};
  rows.forEach((R, i) => { total += i ? R.before : 0; R.off = total; if (R.key) at[R.key] = total; total += R.h; });
  SC.max = Math.max(0, total - avail);
  if (SC.want) { // a section ('coins', 'bank', 'premium'...) lands at the top; a card ('chick:frost', 'iap:coins_s') a little under it, whole, and gets a ring
    const ri = rowOf[SC.want], R = ri != null ? rows[ri] : null;
    if (R) {
      const to = focusY(R.off, R.h, avail, SC.max, s);
      if (!SC.point && !ui.calm) SC.y = Math.max(0, to - 56 * s); // a plain jump (a row, a card): set close, then one soft settle
      focusTrip(SC, to, ui.calm); // 0.8.16: the mark's pick is scrolled to from where the list stands (about 0.4 s), not jumped to
      SC.hl = { key: SC.want, t0: t, dur: SC.hlDur || 1.2, point: !!SC.point }; // the ring (and the hand) stay ~4 s or until a touch
    } else if (at[SC.want] != null) { SC.y = at[SC.want] - (rows[0] && at[SC.want] ? 4 * s : 0); SC.v = 0; }
    SC.want = null;
  }
  SC.y = Math.max(-lim, Math.min(SC.max + lim, SC.y));
  const y0 = bodyTop - snapPx(SC.y, state.dpr || 1); // 2026-11-20: a short list starts at the top (the web's Free tab floated mid-screen)
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
  // the wanted card: a pulsing gold ring (Calm motion: a still one), ui/focus.js
  const look = HL ? focusLook(HL, t, ui.calm) : null;
  if (HL && !look && t - HL.t0 >= 0) SC.hl = null;
  if (hlR && look) focusDraw(ctx, ui, look, hlR, 20 * s, s);
  ctx.restore();
  // the hand taps the card's price chip from below it (never over the art or the price); only while the chip is in the list
  if (hlR && look && look.point && hlR.chip && hlR.chip.y > vt && hlR.chip.y + hlR.chip.h < vb) focusHand(ctx, look, { x: hlR.chip.x + hlR.chip.w * 0.82, y: hlR.chip.y + hlR.chip.h * 0.7, side: hlR.chip.x + hlR.chip.w - 1 * s }, s, { y: vt, h: vb - vt });
  if (SC.max > 0 && !ui.calm) { // a thin scroll thumb
    const th = Math.max(30 * s, (vb - vt) * (vb - vt) / (SC.max + vb - vt)), ty = vt + Math.max(0, Math.min(1, SC.y / SC.max)) * (vb - vt - th - 4 * s);
    ui.roundRect(OX + AW - 5 * s, ty, 3 * s, th, 1.5 * s); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
  }
}

// one coin pack in the Deals grid: the pile, the amount, the price; a "Most popular" / "Best value" pill
function drawPack(ui, ctx, sku, x, y, w, h, s, t, st) {
  const P = IAP[sku], lip = 4 * s, fh = h - lip, p = 9 * s, fl = flashOf(st, 'iap:' + sku), fa = fl < 0.9 ? 1 - fl / 0.9 : 0;
  ui.frame(x, y, w, fh, { s, r: 16 * s, fw: 4.5 * s, lip, glow: '#ffe27a', glowA: fa, record: true, tag: 'panel:card:' + sku });
  ui.buttons.push({ id: 'tile:iap:' + sku, x, y, w, h: fh }); // the whole card: its sheet first
  const bh = 42 * s, amH = 26 * s, artH = fh - 2 * p - bh - amH - 4 * s;
  ui.well(x + p, y + p, w - 2 * p, artH, { s, r: 12 * s, a: '#cfe9fb', b: '#eaf6ff', shade: 'rgba(20,70,130,0.28)', border: 'rgba(60,90,130,0.55)' });
  ui.record({ x: x + p, y: y + p, w: w - 2 * p, h: artH }, 'store:icon:' + sku);
  const bounce = fl < 0.6 ? 1 + 0.18 * Math.sin((fl / 0.6) * Math.PI) : 1;
  coinPile(ctx, x + w / 2, y + p + artH * 0.56, Math.min(artH * 1.05, w * 0.7) * bounce, COIN_PACKS.indexOf(sku) + 2, t);
  if (P.tag === 'Most popular') pill(ui, ctx, P.tag, x + p + 5 * s, y + p + 5 * s, 11.5 * s, '#e8402e', 'store:tag:' + sku, s, 'store:icon:' + sku); // 0.8.9: one "Best value" on the page, and it is Unlock Everything's
  ui.num(fmtNum(P.coins), x + w / 2, y + p + artH + 4 * s + amH / 2, { size: 21 * s, align: 'center', maxW: w - 2 * p, tag: 'store:amt:' + sku });
  ui.button('tile:iap:' + sku, st.price(sku), x + p, y + fh - p - bh, w - 2 * p, bh, { kind: 'primary', size: 17 * s });
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

// state: { wallet, selected: Set of booster ids, lastTapped: id | null, t, rows: most rows of tiles (default 1), hide: ids not to offer }
// Fits inside (x, y, w, h). Ids: 'boost:<id>' per owned booster, 'shop:boosts' per booster still to get.
// 2026-11-23 (mykee: "for those levels we don't show it as an empty kind of a thing ... it should be dynamic"): the
// row is never half empty. The boosters you own come first (tap to take one, the count on its corner); the rest of the
// row is filled with boosters you can get, in full colour with their coin price (a tap opens the shop's Boosts row, the
// same price for everyone). Few tiles grow to fill the room; given the height (rows > 1) they become a grid with names.
// the tile layout the picker will use in (w, h): the one with the biggest tiles. used: the height it really needs
export function boosterLayout(ui, w, h, state) {
  const { wallet, rows: maxRows = 1, hide = [] } = state;
  const owned = BOOSTER_ORDER.filter((id) => ownedCount(wallet, id) > 0);
  const toGet = BOOSTER_ORDER.filter((id) => !owned.includes(id) && !hide.includes(id) && BOOSTERS[id] && BOOSTERS[id].price > 0).sort((a, b) => BOOSTERS[a].price - BOOSTERS[b].price);
  const u = ui.u;
  const gapV = Math.max(2, Math.min(8 * u, h * 0.06));
  const lineSize = Math.max(9, Math.min(14 * u, h * 0.24));
  const lineH = lineSize * 1.2;
  const gridH = Math.max(10, h - lineH - gapV);
  const gap = Math.min(10 * u, w * 0.03);
  let best = null;
  for (let r = 1; r <= Math.max(1, maxRows); r++) {
    const all = owned.length + toGet.length, perRow = r === 1 ? Math.min(all, Math.max(owned.length, 4, Math.floor((w + gap) / (62 * u + gap)))) : Math.ceil(all / r);
    if (owned.length > perRow * r) continue;
    const n = Math.min(all, perRow * r), cols = Math.ceil(n / r);
    const c = Math.min((w - (cols - 1) * gap) / cols, (gridH - (r - 1) * gap) / r, 130 * u);
    if (!best || c > best.c * 1.08) best = { r, cols, n, c };
  }
  const R = Math.ceil(best.n / best.cols);
  return { ...best, R, owned, toGet, gap, gapV, lineSize, lineH, gridH, used: R * best.c + (R - 1) * gap + gapV + lineH };
}
export function drawBoosterPicker(ui, ctx, x, y, w, h, state) {
  const { wallet, selected = new Set(), lastTapped = null, t = 0 } = state;
  const Lo = boosterLayout(ui, w, h, state), { owned, toGet, gap, cols, n, c, R, lineH, gapV, lineSize, gridH } = Lo, u = ui.u;
  const lineCy = y + gridH + gapV + lineH / 2;
  const items = [...owned.map((id) => ({ id, own: true })), ...toGet.map((id) => ({ id, own: false }))].slice(0, n);
  const named = c >= 84 * u; // big tiles carry the booster's name too
  const gy0 = y + (gridH - (R * c + (R - 1) * gap)) / 2;
  items.forEach((it, i) => {
    const row = Math.floor(i / cols), col = i % cols, inRow = Math.min(cols, n - row * cols);
    const cx = x + w / 2 - (inRow * c + (inRow - 1) * gap) / 2 + col * (c + gap), cy0 = gy0 + row * (c + gap), id = it.id, B = BOOSTERS[id];
    if (it.own) {
      const on = selected.has(id);
      ui.button('boost:' + id, '', cx, cy0, c, c, { kind: on ? 'primary' : 'tertiary' });
      const body = c - 5 * u * Math.min(1, c / 40);
      drawBoosterIcon(ctx, id, cx + c * 0.46, cy0 + body * (named ? 0.42 : 0.52), c * (named ? 0.5 : 0.6), t);
      if (named) ui.text(B.name, cx + c / 2, cy0 + c * 0.82, { size: Math.min(15 * u, c * 0.15), align: 'center', maxW: c - 10 * u, color: on ? '#fff' : C.ink, noRecord: true });
      if (on) ui.panel(cx - 2, cy0 - 2, c + 4, c + 2, { fill: 'rgba(0,0,0,0)', r: 16 * u, border: '#fff6c0', lw: Math.max(2, c * 0.05) });
      const br = Math.max(6, Math.min(c * 0.2, 16 * u)), bcx = cx + c - br - c * 0.04, bcy = cy0 + br + c * 0.04;
      ctx.beginPath(); ctx.arc(bcx, bcy, br, 0, Math.PI * 2); ctx.fillStyle = '#e8402e'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#5a110a'; ctx.stroke();
      ui.text(String(ownedCount(wallet, id)), bcx, bcy, { size: br * 1.25, align: 'center', maxW: br * 1.6, color: '#fff', noRecord: true });
      ui.record({ x: bcx - br, y: bcy - br, w: br * 2, h: br * 2, container: 'btn:boost:' + id }, 'picker:badge:' + id, 'picker:badge:' + id);
      if (on) { // check mark, bottom right
        const kx = cx + c - c * 0.2, ky = cy0 + c * (named ? 0.6 : 0.7), ks = c * 0.1;
        ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, c * 0.06); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(kx - ks, ky); ctx.lineTo(kx - ks * 0.25, ky + ks * 0.8); ctx.lineTo(kx + ks * 1.1, ky - ks * 0.8); ctx.stroke(); ctx.restore();
      }
    } else { // one to get: its art in full colour, its name on a big tile, its price in coins
      const afford = ((wallet && wallet.coins) || 0) >= B.price;
      ui.button('shop:boosts', '', cx, cy0, c, c, { kind: 'tertiary', round: 14 * u });
      drawBoosterIcon(ctx, id, cx + c / 2, cy0 + c * (named ? 0.36 : 0.42), c * (named ? 0.46 : 0.56), t);
      const ps = Math.max(8, Math.min(c * 0.2, 17 * u)), pw = Math.min(c - 4 * u, ui.measure(String(B.price), ps) + ps * 2.1);
      if (named) ui.text(B.name, cx + c / 2, cy0 + c * 0.66, { size: Math.min(15 * u, c * 0.15), align: 'center', maxW: c - 10 * u, color: C.ink, noRecord: true });
      const py = cy0 + c - ps * 1.5 - (named ? 6 : 3) * u;
      ui.roundRect(cx + c / 2 - pw / 2, py, pw, ps * 1.5, ps * 0.75);
      ctx.fillStyle = afford ? 'rgba(42,26,10,0.88)' : 'rgba(42,26,10,0.6)'; ctx.fill();
      drawCoin(ctx, cx + c / 2 - pw / 2 + ps * 0.75, py + ps * 0.75, ps * 0.52, t);
      ui.text(String(B.price), cx + c / 2 - pw / 2 + ps * 1.3, py + ps * 0.75, { size: ps, color: afford ? '#ffe27a' : '#d8c8a8', maxW: pw - ps * 1.5, noRecord: true });
    }
  });
  const tapped = lastTapped && BOOSTERS[lastTapped] && ownedCount(wallet, lastTapped) > 0 ? BOOSTERS[lastTapped] : null;
  const str = tapped ? tapped.line : owned.length ? 'Tap a booster to use it this level' : 'Boosters give you a head start. Tap to see them.';
  ui.text(str, x + w / 2, lineCy, { size: lineSize, align: 'center', maxW: w, color: tapped ? C.ink : C.ink2, tag: owned.length ? 'picker:line' : 'picker:hint' });
}

// 0.8.14 (mykee: "I have never ever seen the boosters ... they are hiding right below the chicks pane"): the level card's
// boosters strip, pinned right above its big button on both tabs. A small BOOSTERS label, then one row of square tiles:
// the free video booster first (state.ad: its booster id), the boosters you own (count on the corner; a tap arms one for
// this level, the same 'boost:<id>' as the picker), then the cheapest ones to get with their coin price (a tap opens
// the shop's Boosts row). state.mark(x, y, r): the caller's pulsing mark, on the video tile and on each owned booster
// not armed yet. state.s: the card's scale. Fits in (x, y, w, h).
export function drawBoosterStrip(ui, ctx, x, y, w, h, state) {
  const { wallet, selected = new Set(), lastTapped = null, t = 0, hide = [], ad = null, mark = null, first = [], last = [], teach = null } = state, s = state.s || ui.u;
  // (the ones this level has a use for lead, the ones it has no use for come last: a Scarecrow where no villain lives)
  const rank = (id) => (first.includes(id) ? 0 : last.includes(id) ? 2 : 1);
  const owned = BOOSTER_ORDER.filter((id) => ownedCount(wallet, id) > 0 && !hide.includes(id)).sort((a, b) => rank(a) - rank(b));
  const toGet = BOOSTER_ORDER.filter((id) => !owned.includes(id) && !hide.includes(id) && BOOSTERS[id] && BOOSTERS[id].price > 0).sort((a, b) => BOOSTERS[a].price - BOOSTERS[b].price);
  const lab = 14.5 * s, labH = 17 * s, c = Math.min(h - labH - 2 * s, 64 * s), gap = 8 * s;
  const all = [...(ad && BOOSTERS[ad] ? [{ id: ad, ad: true }] : []), ...owned.map((id) => ({ id, own: true })), ...toGet.map((id) => ({ id }))];
  // 0.8.15: there are eight boosters now and the row holds six tiles. Every booster owned must be within reach (a
  // Scarecrow won on the Lucky Spin that cannot be picked is a broken promise), and no tile shrinks: when they do not
  // all fit, the last tile turns the row to its next page
  const fit = Math.max(1, Math.floor((w + gap) / (c + gap) + 0.001));
  const { items, more } = pageOf(all, fit, state.page || 0);
  const n = items.length + (more ? 1 : 0);
  // the label: BOOSTERS, or the one just tapped and what it does
  // (0.8.15, a booster's lesson: one he owns, has never picked and this level has a use for is named before any tap,
  // with what it does, and its tile glows; no free booster is given for it)
  const say = lastTapped && BOOSTERS[lastTapped] && ownedCount(wallet, lastTapped) > 0 ? lastTapped : teach && BOOSTERS[teach] && ownedCount(wallet, teach) > 0 && !selected.has(teach) ? teach : null, tapped = say ? BOOSTERS[say] : null;
  let str = 'BOOSTERS';
  if (tapped) { const full = `${tapped.name}: ${tapped.line}`; str = ui.measure(full, lab) <= w ? full : tapped.name; }
  const lw = Math.min(w, ui.measure(str, lab));
  if (!tapped && lw < w - 40 * s) { const ly = y + labH / 2, sw = (w - lw) / 2 - 12 * s; ctx.fillStyle = 'rgba(122,80,40,0.25)'; ctx.fillRect(x, ly, sw, 1.5 * s); ctx.fillRect(x + w - sw, ly, sw, 1.5 * s); }
  ui.text(str, x + w / 2, y + labH / 2, { size: lab, align: 'center', maxW: w, color: tapped ? C.ink : '#9a5a1c', tag: 'strip:label' });
  // 0.8.16: a full row runs edge to edge (the same left and right edges as the button under it): the room is shared between the tiles
  const jg = n === fit && n > 1 ? (w - n * c) / (n - 1) : gap, ty = y + labH + 2 * s, tw = n * c + (n - 1) * jg, x0 = x + w / 2 - tw / 2;
  items.forEach((it, i) => {
    const cx = x0 + i * (c + jg), id = it.id, B = BOOSTERS[id], on = it.own && selected.has(id);
    if (it.ad) {
      ui.button('adboost', '', cx, ty, c, c, { kind: 'ad', round: 14 * s });
      drawBoosterIcon(ctx, id, cx + c / 2, ty + c * 0.38, c * 0.5, t);
      const bh = c * 0.26, bw = bh * 1.38; drawAdBadge(ctx, cx + c / 2 - bw / 2, ty + c * 0.76, bw, bh);
      if (mark) mark(cx + c - 9 * s, ty + 9 * s, 7.5 * s); // (inside the tile's corner: clear of its neighbours and the label)
    } else if (it.own) {
      ui.button('boost:' + id, '', cx, ty, c, c, { kind: on ? 'primary' : 'tertiary', round: 14 * s });
      if (id === teach && !on && !lastTapped) { const k = ui.calm ? 0.7 : 0.5 + 0.5 * Math.sin(t * 4); ctx.save(); ui.roundRect(cx - 2 * s, ty - 2 * s, c + 4 * s, c + 4 * s, 16 * s); ctx.lineWidth = 3 * s; ctx.strokeStyle = `rgba(255,196,40,${0.35 + 0.6 * k})`; ctx.stroke(); ctx.restore(); }
      drawBoosterIcon(ctx, id, cx + c / 2, ty + c * 0.38, c * 0.5, t);
      // how many you have, on a chip where the others show their price
      const ps = Math.min(c * 0.22, 14 * s), str = '\u00d7' + ownedCount(wallet, id), pw = Math.min(c - 6 * s, ui.measure(str, ps) + ps * 1.2), py = ty + c - ps * 1.45 - 6 * s;
      ui.roundRect(cx + c / 2 - pw / 2, py, pw, ps * 1.45, ps * 0.72); ctx.fillStyle = on ? 'rgba(20,70,10,0.75)' : 'rgba(42,26,10,0.88)'; ctx.fill();
      ui.text(str, cx + c / 2, py + ps * 0.74, { size: ps, align: 'center', color: '#fff', maxW: pw - ps * 0.6, noRecord: true });
      if (on) { // armed for this level: a white disc with a green check in the corner
        const kx = cx + c - 9 * s, ky = ty + 9 * s, kr = 7.5 * s;
        ctx.save(); ctx.beginPath(); ctx.arc(kx, ky, kr, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = '#2f8a1c'; ctx.lineWidth = kr * 0.32; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(kx - kr * 0.45, ky); ctx.lineTo(kx - kr * 0.1, ky + kr * 0.38); ctx.lineTo(kx + kr * 0.5, ky - kr * 0.35); ctx.stroke(); ctx.restore();
      } else if (mark) mark(cx + c - 9 * s, ty + 9 * s, 7.5 * s);
    } else {
      const afford = ((wallet && wallet.coins) || 0) >= B.price;
      ui.button('shop:boosts', '', cx, ty, c, c, { kind: 'tertiary', round: 14 * s });
      drawBoosterIcon(ctx, id, cx + c / 2, ty + c * 0.38, c * 0.5, t);
      const ps = Math.min(c * 0.22, 14 * s), pw = Math.min(c - 6 * s, ui.measure(String(B.price), ps) + ps * 2), py = ty + c - ps * 1.45 - 6 * s;
      ui.roundRect(cx + c / 2 - pw / 2, py, pw, ps * 1.45, ps * 0.72);
      ctx.fillStyle = afford ? 'rgba(42,26,10,0.88)' : 'rgba(42,26,10,0.6)'; ctx.fill();
      drawCoin(ctx, cx + c / 2 - pw / 2 + ps * 0.72, py + ps * 0.72, ps * 0.5, t);
      ui.text(String(B.price), cx + c / 2 - pw / 2 + ps * 1.3, py + ps * 0.74, { size: ps, color: afford ? '#ffe27a' : '#d8c8a8', maxW: pw - ps * 1.4, noRecord: true });
    }
  });
  if (more) { // the row's next page: an arrow, and a dot for each page
    const cx = x0 + items.length * (c + jg), mx = cx + c / 2, my = ty + c * 0.4, a = c * 0.13;
    ui.button('strip:more', '', cx, ty, c, c, { kind: 'secondary', round: 14 * s });
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, c * 0.085); ctx.strokeStyle = '#fff';
    for (const dx of [-a * 0.75, a * 0.75]) { ctx.beginPath(); ctx.moveTo(mx + dx - a * 0.5, my - a); ctx.lineTo(mx + dx + a * 0.5, my); ctx.lineTo(mx + dx - a * 0.5, my + a); ctx.stroke(); }
    const dr = Math.min(3.2 * s, c * 0.06), dg = dr * 3.2, dx0 = mx - ((more.pages - 1) * dg) / 2, dy = ty + c - 11 * s;
    for (let i = 0; i < more.pages; i++) { ctx.beginPath(); ctx.arc(dx0 + i * dg, dy, dr, 0, Math.PI * 2); ctx.fillStyle = i === more.pg ? '#fff' : 'rgba(255,255,255,0.4)'; ctx.fill(); }
    ctx.restore();
  }
}

// Art for an offer card (offers.js): a product by sku, or an item: 'charge' (a Chick Charge), 'coins', 'chick:<id>'.
export function drawOfferArt(ctx, key, cx, cy, it, t, wallet) {
  if (IAP[key]) return drawIapArt(ctx, key, cx, cy, it, t, wallet);
  if (key === 'charge') return drawStrikeToken(ctx, 'freeze', cx, cy, it * 0.36, t, true);
  if (key === 'coins') return coinPile(ctx, cx, cy, it, 3, t);
  if (key.startsWith('chick:')) return drawStrikeToken(ctx, key.slice(6), cx, cy, it * 0.38, t, true);
}
