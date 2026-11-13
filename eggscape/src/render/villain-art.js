// Live portraits for the "Who's in this vault" panel (main.js drawInfo). Each villain is drawn by its OWN renderer at a
// fixed small size, in screen space (y down), centred in a d x d box. Kinds and texts: src/data/villain-info.js.
// No sim state is touched: every call here is a pure art function (poses come from t only).
// Not drawn by their own renderer (no cheap standalone art, or the owner retired the figure):
//   boss:blizzard  -> its boss-bar emblem (a snowflake chip): the storm has no body in the game
//   boss:golem     -> its boss-bar emblem (a crystal chip): the owner retired the golem figure
//   hazards        -> small code-drawn icons in the game's palette (icicle, lava rock, bolt, gust, current, spikes,
//                     vine); the curse and thorn orbs use the game's own drawOrb.
import { drawGeckoEmblem } from './gecko15.js';
import { drawSnake } from './snake.js';
import { drawThief, thiefPose, drawThiefEmblem } from './thieves.js';
import { drawOctopus } from './octopus.js';
import { drawFish } from './sea.js';
import { drawFrog } from './frog.js';
import { drawEagle } from './v3art.js';
import { drawSalamander } from './salamander.js';
import { drawHermit, drawPuffer, drawJelly } from './reef.js';
import { drawGator, drawTurtle, drawSwarm, drawGatorEmblem } from './bayou.js';
import { drawCwIntro } from './clockwork.js';
import { drawKingEmblem } from './kingcrab.js';
import { drawOwlEmblem } from './owl.js';
import { drawOrb } from './powers.js';

const TAU = Math.PI * 2;
const INK = '#2a1606';

// the backdrop of each portrait: creatures a cool night blue (the intro cards' art stage), bosses a dark red hall,
// hazards a slate grey
export const PORTRAIT_BG = { creature: ['#31476e', '#1b2742'], boss: ['#6a1830', '#2c0a1c'], hazard: ['#4a4f5c', '#262a33'] };

function chip(ctx, cx, cy, r, col) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = col; ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.1); ctx.strokeStyle = '#ffe3b0'; ctx.stroke();
}

const ART = {
  snake(ctx, x, y, d, t) {
    const pts = [];
    for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push({ x: x + d * (0.08 - 0.5 * u), y: y - d * 0.08 + Math.sin(u * 5.2 + 0.4) * d * 0.14 + u * d * 0.14 }); }
    drawSnake(ctx, pts, d * 0.06, t, { skin: 'violet' });
  },
  'boss:snake'(ctx, x, y, d, t) {
    const big = [], small = [];
    for (let i = 0; i <= 24; i++) { const u = i / 24; big.push({ x: x + d * (0.06 - 0.5 * u), y: y + d * 0.14 + Math.sin(u * 5 + 0.3) * d * 0.08 }); }
    for (let i = 0; i <= 16; i++) { const u = i / 16; small.push({ x: x + d * (-0.34 + 0.44 * u), y: y - d * 0.22 + Math.sin(u * 6 + 1) * d * 0.05 }); }
    drawSnake(ctx, small, d * 0.035, t, { skin: 'emerald' });
    drawSnake(ctx, big, d * 0.07, t, { skin: 'violet' });
  },
  weasel(ctx, x, y, d, t) { const s = d * 0.5; drawThief(ctx, x - d * 0.04, y + d * 0.22, s, t, thiefPose('weasel', 'idle', t), { face: 1 }, 'weasel'); },
  rats(ctx, x, y, d, t) {
    const s = d * 0.38;
    drawThief(ctx, x - d * 0.16, y + d * 0.12, s, t + 0.7, thiefPose('rat', 'idle', t + 0.7), { face: 1 }, 'rat');
    drawThief(ctx, x + d * 0.08, y + d * 0.32, s, t, thiefPose('rat', 'idle', t), { face: 1 }, 'rat');
  },
  'boss:weasel'(ctx, x, y, d, t) { ctx.save(); ctx.translate(x + d * 0.22, y - d * 0.04); drawThiefEmblem(ctx, 'weasel', d * 0.62, t); ctx.restore(); },
  'boss:ratking'(ctx, x, y, d, t) { ctx.save(); ctx.translate(x + d * 0.2, y - d * 0.06); drawThiefEmblem(ctx, 'ratking', d * 0.56, t); ctx.restore(); },
  octopus(ctx, x, y, d, t) { drawOctopus(ctx, x, y - d * 0.08, d * 0.3, t, {}); },
  fish(ctx, x, y, d, t) {
    const L = d * 0.3;
    [[-0.2, -0.16, 0], [0.16, -0.02, 1.3], [-0.12, 0.2, 2.1]].forEach(([fx, fy, ph]) => drawFish(ctx, x + fx * d + Math.sin(t * 1.3 + ph) * d * 0.03, y + fy * d, L, 0, t + ph, { flip: 1 }));
  },
  frog(ctx, x, y, d, t) { drawFrog(ctx, x, y + d * 0.3, d * 0.8, t, { look: { x: 0.4, y: 0.1 }, face: 1 }); },
  eagle(ctx, x, y, d, t) { drawEagle(ctx, x, y + d * 0.06, d * 0.42, t, { w: { hover: 1 }, phase: t * 8.5, face: 1 }); },
  'boss:eagle'(ctx, x, y, d, t) { drawEagle(ctx, x, y + d * 0.06, d * 0.46, t, { w: { hover: 1 }, phase: t * 8.5, face: -1 }); },
  salamander(ctx, x, y, d, t) {
    const S = d * 0.4;
    drawSalamander(ctx, x + 0.8 * S, y + d * 0.06, S, t, { heading: 0, curve: -0.12 / S, pose: 'idle', glow: 0.75 + 0.2 * Math.sin(t * 2), look: { x: 0.4, y: 0.5 }, id: 9101 });
  },
  'boss:salamander'(ctx, x, y, d, t) {
    const S = d * 0.44;
    drawSalamander(ctx, x + 0.78 * S, y + d * 0.08, S, t, { heading: 0, curve: -0.12 / S, pose: 'idle', glow: 1, look: { x: 0.4, y: 0.5 }, id: 9102 });
  },
  hermit(ctx, x, y, d, t) { drawHermit(ctx, x + d * 0.04, y + d * 0.26, d * 0.8, t, { pose: 'walk', u: t * 0.6 }); },
  puffer(ctx, x, y, d, t) { drawPuffer(ctx, x, y, d * 0.62, t, { sw: 0.5 + 0.5 * Math.sin(t * 1.4) }); },
  jelly(ctx, x, y, d, t) { drawJelly(ctx, x, y - d * 0.12, d * 0.72, t, {}); },
  gator(ctx, x, y, d, t) { ctx.save(); ctx.translate(x - d * 0.1, y + d * 0.16); drawGator(ctx, d * 0.86, t, { jaw: 0.35 + 0.15 * Math.sin(t * 1.6), eye: 'open', look: -0.4 }); ctx.restore(); },
  'boss:gator'(ctx, x, y, d, t) { ctx.save(); ctx.translate(x, y); drawGatorEmblem(ctx, d * 0.5, t); ctx.restore(); },
  turtle(ctx, x, y, d, t) { ctx.save(); ctx.translate(x - d * 0.04, y + d * 0.18); drawTurtle(ctx, d * 0.84, t, { head: 0.1 + 0.1 * Math.sin(t * 1.5), glare: 1 }); ctx.restore(); },
  mosquito(ctx, x, y, d, t) { drawSwarm(ctx, x, y, d * 0.3, t, {}); },
  spider(ctx, x, y, d, t) { drawCwIntro(ctx, 'spider', x - d / 2, y - d / 2, d, d * 0.9, t); },
  beetle(ctx, x, y, d, t) { drawCwIntro(ctx, 'beetle', x - d / 2, y - d * 0.36, d, d * 0.5, t); },
  jack(ctx, x, y, d, t) { drawCwIntro(ctx, 'jack', x - d / 2, y - d * 0.45, d, d * 0.8, t); },
  'boss:kingcrab'(ctx, x, y, d, t) { ctx.save(); ctx.translate(x, y); drawKingEmblem(ctx, d * 0.38, t); ctx.restore(); },
  'boss:owl'(ctx, x, y, d, t) { ctx.save(); ctx.translate(x, y - d * 0.06); drawOwlEmblem(ctx, d * 0.3, t); ctx.restore(); },
  // the boss-bar emblems (render/boss.js drawBossEmblem; that function is not exported, so the two shapes are redrawn here)
  'boss:blizzard'(ctx, x, y, d, t) { ctx.save(); ctx.translate(x, y); drawGeckoEmblem(ctx, d * 0.34, t); ctx.restore(); }, // Baron von Brr, the frost gecko
  'boss:golem'(ctx, x, y, d, t) {
    const r = d * 0.34;
    chip(ctx, x, y, r, '#6a4fc8');
    ctx.save(); ctx.translate(x, y + Math.sin(t * 1.5) * r * 0.04);
    ctx.fillStyle = '#d9c8ff'; ctx.strokeStyle = '#3a2a70'; ctx.lineWidth = r * 0.08; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(r * 0.4, -r * 0.1); ctx.lineTo(r * 0.25, r * 0.6); ctx.lineTo(-r * 0.25, r * 0.6); ctx.lineTo(-r * 0.4, -r * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  },
  // ---- hazards: small icons
  icicles(ctx, x, y, d, t) {
    const sh = Math.sin(t * 9) * d * 0.012 * (Math.sin(t * 1.3) > 0.5 ? 1 : 0);
    ctx.fillStyle = '#8a8f99'; ctx.fillRect(x - d * 0.36, y - d * 0.34, d * 0.72, d * 0.08);
    [[-0.18, 0.5], [0.04, 0.68], [0.22, 0.42]].forEach(([fx, L]) => {
      const cx = x + fx * d + sh, top = y - d * 0.26, w = d * 0.075;
      ctx.beginPath(); ctx.moveTo(cx - w, top); ctx.lineTo(cx + w, top); ctx.lineTo(cx, top + L * d * 0.75); ctx.closePath();
      const g = ctx.createLinearGradient(cx - w, 0, cx + w, 0); g.addColorStop(0, '#f2fbff'); g.addColorStop(1, '#8fcbea');
      ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1, d * 0.02); ctx.strokeStyle = '#2f6a94'; ctx.stroke();
    });
  },
  lava(ctx, x, y, d, t) {
    const r = d * 0.24, gl = 0.6 + 0.4 * Math.sin(t * 3);
    const g = ctx.createRadialGradient(x, y + d * 0.04, 0, x, y + d * 0.04, r * 1.9);
    g.addColorStop(0, `rgba(255,140,40,${0.45 * gl})`); g.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = g; ctx.fillRect(x - d / 2, y - d / 2, d, d);
    ctx.beginPath();
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, rr = r * (0.82 + 0.18 * Math.sin(i * 2.7)); ctx.lineTo(x + Math.cos(a) * rr, y + d * 0.04 + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = '#3a2420'; ctx.fill(); ctx.lineWidth = Math.max(1, d * 0.03); ctx.strokeStyle = INK; ctx.stroke();
    ctx.strokeStyle = `rgba(255,${150 + 80 * gl | 0},60,0.95)`; ctx.lineWidth = Math.max(1, d * 0.035); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - r * 0.5, y); ctx.lineTo(x - r * 0.05, y + r * 0.25); ctx.lineTo(x + r * 0.45, y - r * 0.1); ctx.moveTo(x - r * 0.05, y + r * 0.25); ctx.lineTo(x, y + r * 0.7); ctx.stroke();
  },
  lightning(ctx, x, y, d, t) {
    const on = (t % 1.6) < 1.1 ? 0.35 + 0.3 * Math.abs(Math.sin(t * 20)) : 1, r = d * 0.38;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= on;
    ctx.fillStyle = '#ffe14a'; ctx.beginPath();
    ctx.moveTo(r * 0.15, -r * 0.85); ctx.lineTo(-r * 0.4, r * 0.1); ctx.lineTo(-r * 0.02, r * 0.1); ctx.lineTo(-r * 0.18, r * 0.85); ctx.lineTo(r * 0.42, -r * 0.14); ctx.lineTo(r * 0.04, -r * 0.14); ctx.closePath();
    ctx.fill(); ctx.lineJoin = 'round'; ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = Math.max(1.2, r * 0.09); ctx.stroke();
    ctx.restore();
  },
  gusts(ctx, x, y, d, t) {
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#eaf4ff'; ctx.lineWidth = Math.max(1.5, d * 0.045);
    [[-0.2, 0.5, 0], [0, 0.62, 0.4], [0.2, 0.44, 0.8]].forEach(([fy, L, ph]) => {
      const sx = x - d * 0.36 + ((t * 0.5 + ph) % 1) * d * 0.12, yy = y + fy * d;
      ctx.beginPath(); ctx.moveTo(sx, yy); ctx.lineTo(sx + L * d * 0.8, yy); ctx.arc(sx + L * d * 0.8, yy - d * 0.07, d * 0.07, Math.PI / 2, -Math.PI * 0.9, true); ctx.stroke();
    });
    ctx.restore();
  },
  current(ctx, x, y, d, t) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#9fe0ff'; ctx.lineWidth = Math.max(1.5, d * 0.045);
    for (const fy of [-0.18, 0.04, 0.26]) {
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) { const u = i / 20, xx = x - d * 0.36 + u * d * 0.66; ctx.lineTo(xx, y + fy * d + Math.sin(u * 9 - t * 4) * d * 0.035); }
      ctx.stroke();
      const ax = x + d * 0.32, ay = y + fy * d + Math.sin(9 - t * 4) * d * 0.035;
      ctx.beginPath(); ctx.moveTo(ax - d * 0.07, ay - d * 0.06); ctx.lineTo(ax, ay); ctx.lineTo(ax - d * 0.07, ay + d * 0.06); ctx.stroke();
    }
    ctx.restore();
  },
  embers(ctx, x, y, d, t) {
    for (let i = 0; i < 5; i++) {
      const u = ((t * 0.35 + i * 0.21) % 1), ex = x + (i - 2) * d * 0.15 + Math.sin(t * 2 + i) * d * 0.03, ey = y - d * 0.4 + u * d * 0.8, r = d * (0.035 + 0.012 * (i % 2));
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, r * 3); g.addColorStop(0, 'rgba(255,170,60,0.55)'); g.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = g; ctx.fillRect(ex - r * 3, ey - r * 3, r * 6, r * 6);
      ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(ex, ey, r, 0, TAU); ctx.fill();
    }
  },
  quake(ctx, x, y, d, t) {
    const sh = Math.sin(t * 30) * d * 0.02 * (Math.sin(t * 1.4) > 0.3 ? 1 : 0);
    ctx.save(); ctx.translate(sh, 0);
    ctx.fillStyle = '#8f8a83'; ctx.fillRect(x - d * 0.38, y + d * 0.1, d * 0.76, d * 0.14);
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, d * 0.025); ctx.strokeRect(x - d * 0.38, y + d * 0.1, d * 0.76, d * 0.14);
    ctx.beginPath(); ctx.moveTo(x - d * 0.06, y + d * 0.1); ctx.lineTo(x + d * 0.02, y + d * 0.16); ctx.lineTo(x - d * 0.03, y + d * 0.24); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,240,210,0.8)'; ctx.lineWidth = Math.max(1.2, d * 0.03); ctx.lineCap = 'round';
    for (const sd of [-1, 1]) for (let i = 0; i < 2; i++) { const r = d * (0.14 + i * 0.09); ctx.beginPath(); ctx.arc(x, y - d * 0.06, r, sd > 0 ? -0.6 : Math.PI - 0.6, sd > 0 ? 0.6 : Math.PI + 0.6); ctx.stroke(); }
  },
  rain(ctx, x, y, d, t) {
    ctx.strokeStyle = '#9fd0ff'; ctx.lineWidth = Math.max(1.2, d * 0.03); ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) { const u = (t * 1.2 + i * 0.37) % 1, rx = x - d * 0.36 + i * d * 0.12, ry = y - d * 0.42 + u * d * 0.6; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - d * 0.04, ry + d * 0.12); ctx.stroke(); }
    ctx.fillStyle = '#8f99a5'; ctx.fillRect(x - d * 0.38, y + d * 0.24, d * 0.76, d * 0.1);
    ctx.fillStyle = 'rgba(160,210,255,0.6)'; ctx.fillRect(x - d * 0.38, y + d * 0.22, d * 0.76, d * 0.03);
  },
  popthorns(ctx, x, y, d, t) {
    const ext = 0.5 + 0.5 * Math.sin(t * 2.4);
    ctx.fillStyle = '#8f99a5'; ctx.fillRect(x - d * 0.38, y + d * 0.14, d * 0.76, d * 0.12);
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, d * 0.02); ctx.strokeRect(x - d * 0.38, y + d * 0.14, d * 0.76, d * 0.12);
    for (const fx of [-0.24, 0, 0.24]) {
      const cx = x + fx * d, h = d * (0.08 + 0.3 * ext);
      ctx.beginPath(); ctx.moveTo(cx - d * 0.08, y + d * 0.14); ctx.lineTo(cx, y + d * 0.14 - h); ctx.lineTo(cx + d * 0.08, y + d * 0.14); ctx.closePath();
      ctx.fillStyle = '#d23a3a'; ctx.fill(); ctx.stroke();
    }
  },
  vines(ctx, x, y, d, t) {
    const k = 0.55 + 0.45 * Math.sin(t * 0.9);
    ctx.fillStyle = '#b9854e';
    ctx.fillRect(x - d * 0.42, y - d * 0.06, d * 0.22, d * 0.14); ctx.fillRect(x + d * 0.2, y - d * 0.06, d * 0.22, d * 0.14);
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#2f6a2a'; ctx.lineWidth = Math.max(1.5, d * 0.05);
    ctx.beginPath(); ctx.moveTo(x - d * 0.2, y); for (let i = 0; i <= 12; i++) { const u = i / 12 * k; ctx.lineTo(x - d * 0.2 + u * d * 0.4, y + Math.sin(u * 14) * d * 0.04); } ctx.stroke();
    ctx.fillStyle = '#c23a3a';
    for (let i = 1; i <= 4; i++) { const u = i / 5 * k, px = x - d * 0.2 + u * d * 0.4, py = y + Math.sin(u * 14) * d * 0.04, s2 = i % 2 ? -1 : 1; ctx.beginPath(); ctx.moveTo(px - d * 0.03, py); ctx.lineTo(px, py + s2 * d * 0.09); ctx.lineTo(px + d * 0.03, py); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  },
  curse(ctx, x, y, d, t) { drawOrb(ctx, 'curse', x, y, d * 0.3, t, true); },
  thornorb(ctx, x, y, d, t) { drawOrb(ctx, 'thorn', x, y, d * 0.3, t, true); },
};

// a neat lettered badge: the last resort if an art function throws
function badge(ctx, kind, x, y, d) {
  chip(ctx, x, y, d * 0.32, '#6a4a2a');
  ctx.fillStyle = '#fff'; ctx.font = `600 ${Math.round(d * 0.32)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(kind.replace('boss:', '')[0].toUpperCase(), x, y + d * 0.02);
}

export const hasPortrait = (kind) => !!ART[kind];

// the portrait of `kind` centred at (x, y) in a d x d box (the caller clips it)
export function drawVillainPortrait(ctx, kind, x, y, d, t) {
  const f = ART[kind];
  ctx.save();
  try {
    if (f) f(ctx, x, y, d, t); else badge(ctx, kind, x, y, d);
  } catch (e) {
    ctx.restore(); ctx.save();
    badge(ctx, kind, x, y, d);
  }
  ctx.restore();
}
