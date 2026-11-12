// Draws the playfield in world space: ctx is pre-transformed (meters, y up).
import { EGG_H, EGG_W, RING_TH, TAU, eggPoint, rng } from '../sim/geom.js';
import { drawChick } from './characters.js';
import { isSpriteCalm } from './sprites.js';
import { drawEagle, drawEagleShadow, drawBarrier, drawVenom } from './v3art.js';
import { statusClock, statusDraw, boltStroke } from './status.js';
import { drawEggPower, drawOrb } from './powers.js';
import { EAGLE_LEN } from '../sim/sim.js';
import { P2 } from '../sim/powers2.js'; // v3.4: shrink ray size
import { drawLavaRock, drawMeltHole, drawIcicle, drawEggKind, drawThornCurtain, drawThornVine, drawGrate, drawOneWayMark } from './v3art.js';
import { drawSkinPreview } from '../ui/store.js';
import { ringPt, ringSpd, ringNormal, ringReach } from '../sim/shapes.js'; // v3.3 M10 vault shapes
import { LIGHT, WALL, mix, lighten, darken, rgbOf, drawRingBody, drawRingBurn, drawPads, ringLine, ringBand } from './ringart.js';

let skin = 'classic';
export function setSkin(id) { skin = id || 'classic'; }

const EGG_PATH = (() => {
  const pts = [];
  for (let i = 0; i < 40; i++) pts.push(eggPoint((i / 40) * TAU));
  return pts;
})();

function eggPath(ctx, s = 1) {
  ctx.beginPath();
  for (let i = 0; i < EGG_PATH.length; i++) {
    const p = EGG_PATH[i];
    if (i) ctx.lineTo(p.x * s, p.y * s);
    else ctx.moveTo(p.x * s, p.y * s);
  }
  ctx.closePath();
}

function annulus(ctx, ri, ro, a0, a1) {
  ctx.beginPath();
  ctx.arc(0, 0, ro, a0, a1);
  ctx.arc(0, 0, ri, a1, a0, true);
  ctx.closePath();
}

// Contiguous alive arcs of a ring.
function liveArcs(ring) {
  const arcs = [];
  let cur = null;
  for (const s of ring.segs) {
    if (!s.alive || s.melt > 0) { cur = null; continue; } // v3: a lava-melted hole draws as a gap
    if (cur && Math.abs(cur[1] - s.a0) < 1e-4) cur[1] = s.a1;
    else { cur = [s.a0, s.a1]; arcs.push(cur); }
  }
  // merge wrap-around
  if (arcs.length > 1) {
    const f = arcs[0], l = arcs[arcs.length - 1];
    if (Math.abs(l[1] - TAU - f[0]) < 1e-4 || Math.abs(l[1] - (f[0] + TAU)) < 1e-4) { f[0] = l[0] - TAU; arcs.pop(); }
  }
  return arcs;
}

const MAT_STYLE = {
  wood: { seam: 0.55, grain: true },
  stone: { seam: 0.42, blocks: true },
  ice: { alpha: 0.78, shine: true },
  mushroom: { dots: true },
  glass: { alpha: 0.55, shine: true },
  metal: { rivets: true, shine: true },
  coral: { bumps: true },
  vine: { leaves: true },
  cloud: { puffs: true },
  obsidian: { veins: true },
  bone: { seam: 0.3 },
  gold: { shine: true, rivets: true },
};

const DEFAULT_RING = { base: '#b27a45', light: '#d9a46a', dark: '#5a3a20' };
const MAT_COLORS = {
  ice: { base: '#a8dcf5', light: '#eaf8ff', dark: '#3f7fa8' },
  mushroom: { base: '#d8423a', light: '#ff8a78', dark: '#6e1c18' },
  glass: { base: '#9fe6e8', light: '#ffffff', dark: '#3b8f9c' },
  metal: { base: '#8e9aa8', light: '#d7dfe8', dark: '#3c4552' },
  cloud: { base: '#eef3fb', light: '#ffffff', dark: '#8fa0bf' },
  obsidian: { base: '#4a3f55', light: '#8d7aa0', dark: '#140f19' },
  gold: { base: '#e2ac2f', light: '#ffe58a', dark: '#7a5208' },
  stone: { base: '#a39a8c', light: '#d1c8b8', dark: '#5a5248' },
  vine: { base: '#4f8a3a', light: '#86c25e', dark: '#21401a' },
  coral: { base: '#ef7f6b', light: '#ffb7a3', dark: '#8e3a35' },
  bone: { base: '#e6dcc4', light: '#fffaf0', dark: '#8c826c' },
};

export function ringColors(ring, theme) {
  const own = theme?.material === ring.mat && theme?.palette?.ring;
  return own || MAT_COLORS[ring.mat] || theme?.palette?.ring || DEFAULT_RING;
}

// A soft dark plate behind the vault: lifts the rings off busy backdrops (lava streams, crystals, rain) without hiding
// the world. Light skies get a faint cool tint, dark worlds a deeper well.
let plateKey = '', plateG = null;
export function drawVaultBack(ctx, sim, theme) {
  const outer = sim.rings[sim.rings.length - 1];
  if (!outer) return;
  const R = (outer.prof ? ringReach(outer) : outer.r) + RING_TH / 2 + 0.34, P = theme?.palette || {};
  const key = (theme?.id || '') + '|' + R.toFixed(2);
  if (key !== plateKey) {
    const sky = (luma(P.skyTop) + luma(P.skyBottom)) / 2, a = sky > 0.3 ? 0.2 : sky > 0.12 ? 0.36 : 0.5;
    const tint = mix(P.skyTop || '#102030', '#05040c', sky > 0.3 ? 0.72 : 0.8);
    const [r, g, b] = rgbOf(tint);
    plateG = ctx.createRadialGradient(0, 0, 0, 0, 0, R + 0.7);
    plateG.addColorStop(0, `rgba(${r},${g},${b},${a * 0.8})`);
    plateG.addColorStop(R / (R + 0.7) - 0.02, `rgba(${r},${g},${b},${a})`);
    plateG.addColorStop(R / (R + 0.7), `rgba(${r},${g},${b},${a * 0.62})`);
    plateG.addColorStop(1, `rgba(${r},${g},${b},0)`);
    plateKey = key;
  }
  ctx.fillStyle = plateG;
  ctx.beginPath();
  ctx.arc(0, 0, R + 0.7, 0, TAU);
  ctx.fill();
}

export function drawRing(ctx, ring, theme, k, t, opts = {}) {
  const st = MAT_STYLE[ring.mat] || MAT_STYLE.wood;
  const col = ringColors(ring, theme);
  const r = ring.r, ri = r - RING_TH / 2, ro = r + RING_TH / 2;
  const px = 1 / k;
  // slab: drop shadow, side wall, cached top face, outline, bevel light (render/ringart.js)
  const arcs = drawRingBody(ctx, ring, col, st, k);
  ctx.save();
  ctx.rotate(ring.body.getAngle());
  // glass damage
  if (ring.M.hp && !ring.prof) {
    ctx.lineCap = 'round';
    for (const s of ring.segs) {
      if (!s.alive || s.hp >= ring.M.hp) continue;
      const a = (s.a0 + s.a1) / 2;
      const dmg = ring.M.hp - s.hp;
      for (const [lw, c] of [[0.03, 'rgba(20,40,60,0.55)'], [0.012, '#ffffff']]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = lw;
        ctx.beginPath();
        for (let j = 0; j < dmg + 1; j++) {
          const aa = a + (j - dmg / 2) * 0.04;
          ctx.moveTo(ri * Math.cos(aa), ri * Math.sin(aa));
          ctx.lineTo((r + 0.02) * Math.cos(aa + 0.03), (r + 0.02) * Math.sin(aa + 0.03));
          ctx.lineTo(ro * Math.cos(aa - 0.01), ro * Math.sin(aa - 0.01));
        }
        ctx.stroke();
      }
    }
  }
  drawRingBurn(ctx, ring);
  drawPads(ctx, ring, theme, px, t, opts.eggs || [], opts.simT || 0);
  if (!ring.prof) {
    drawHoney(ctx, ring, px, t, opts.stuck);
    drawShutters(ctx, ring, col, px);
  }
  drawThorns(ctx, ring, theme, px, t, opts);
  // grab highlight (screen-constant width, not a glow)
  if (opts.held || opts.hover) {
    ctx.strokeStyle = opts.held ? '#ffffff' : 'rgba(255,255,255,0.6)';
    ctx.lineWidth = (opts.held ? 3 : 2) * px;
    ctx.lineCap = 'butt';
    ctx.setLineDash(opts.held ? [] : [8 * px, 6 * px]);
    for (const [a0, a1] of arcs) {
      ringLine(ctx, ring, ro + 4 * px, a0, a1);
      ctx.stroke();
      ringLine(ctx, ring, ri - 4 * px, a0, a1);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  ctx.restore();
  if (ring.stun > 0) drawStun(ctx, ring, t, px);
}

// Gap shutters: two sliding doors close the gap from its edges (F15c).
function drawShutters(ctx, ring, col, px) {
  const ri = ring.r - RING_TH / 2 + 0.015, ro = ring.r + RING_TH / 2 - 0.015;
  for (const g of ring.gaps) {
    if (!g.shut) continue;
    const half = g.len / (2 * ring.r), shut = half * (1 - g.o);
    // door frames at both edges
    ctx.strokeStyle = 'rgba(30,24,20,0.7)';
    ctx.lineWidth = Math.max(3 * px, 0.03);
    ctx.beginPath();
    for (const b of [g.a - half, g.a + half]) {
      ctx.moveTo((ri - 0.03) * Math.cos(b), (ri - 0.03) * Math.sin(b));
      ctx.lineTo((ro + 0.03) * Math.cos(b), (ro + 0.03) * Math.sin(b));
    }
    ctx.stroke();
    if (shut < 0.004) continue;
    for (const e of [-1, 1]) {
      const a0 = e < 0 ? g.a - half : g.a + half - shut, a1 = e < 0 ? g.a - half + shut : g.a + half;
      annulus(ctx, ri, ro, a0, a1);
      ctx.fillStyle = '#7f8792';
      ctx.fill();
      ctx.strokeStyle = '#2c3138';
      ctx.lineWidth = Math.max(1.5 * px, 0.014);
      ctx.stroke();
      // hazard stripe on the leading edge
      const lead = e < 0 ? a1 : a0;
      ctx.strokeStyle = '#ffcc33';
      ctx.lineWidth = Math.max(3 * px, 0.03);
      ctx.beginPath();
      ctx.moveTo(ri * Math.cos(lead - e * 0.02), ri * Math.sin(lead - e * 0.02));
      ctx.lineTo(ro * Math.cos(lead - e * 0.02), ro * Math.sin(lead - e * 0.02));
      ctx.stroke();
    }
  }
}

const BRASS = '#d39a34', BRASS_DK = '#6b4410', BRASS_LT = '#ffe08a';

// The idler cog between two geared rings, at the top of the channel between them: brass, meshing with
// both rings' teeth, spinning as they turn.
export function drawGearCog(ctx, inner, outer, t) {
  const rc = (outer.r - inner.r - RING_TH - 0.04) / 2;
  if (rc < 0.08) return;
  const R = (inner.r + outer.r) / 2, a = Math.PI / 2 + 0.35;
  ctx.save();
  ctx.translate(R * Math.cos(a), R * Math.sin(a));
  const spin = (-inner.body.getAngle() * (inner.r + RING_TH / 2)) / rc;
  const n = 12;
  const teeth = () => {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const rr = i % 2 ? rc * 0.8 : rc;
      const b = (i / (n * 2)) * TAU;
      ctx.lineTo(rr * Math.cos(b - 0.1), rr * Math.sin(b - 0.1));
      ctx.lineTo(rr * Math.cos(b + 0.1), rr * Math.sin(b + 0.1));
    }
    ctx.closePath();
  };
  ctx.lineJoin = 'round';
  // drop shadow and the cog's own thickness
  for (const [ox, oy, c] of [[0.05, -0.12, 'rgba(6,4,14,0.26)'], [0, -0.07, '#4a2e08'], [0, -0.035, '#6b4410']]) {
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(spin); teeth(); ctx.fillStyle = c; ctx.fill();
    if (oy === -0.07) { ctx.strokeStyle = '#2e1c04'; ctx.lineWidth = 0.03; ctx.stroke(); }
    ctx.restore();
  }
  ctx.save();
  ctx.rotate(spin);
  teeth();
  ctx.strokeStyle = '#3a2406'; ctx.lineWidth = 0.034; ctx.stroke();
  ctx.fillStyle = BRASS;
  ctx.fill();
  ctx.restore();
  // lighting stays put while the cog turns: lit top-left, shaded bottom-right
  ctx.save();
  ctx.rotate(spin); teeth(); ctx.rotate(-spin);
  ctx.clip();
  const g = ctx.createLinearGradient(-rc * 0.7, rc * 0.7, rc * 0.7, -rc * 0.7);
  g.addColorStop(0, 'rgba(255,244,190,0.7)'); g.addColorStop(0.45, 'rgba(255,230,150,0.05)'); g.addColorStop(1, 'rgba(70,34,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(-rc, -rc, rc * 2, rc * 2);
  ctx.restore();
  ctx.save();
  ctx.rotate(spin);
  // dished face with four windows cut through it
  ctx.beginPath(); ctx.arc(0, 0, rc * 0.68, 0, TAU);
  ctx.strokeStyle = BRASS_DK; ctx.lineWidth = 0.022; ctx.stroke();
  ctx.fillStyle = '#2a1806';
  for (let i = 0; i < 4; i++) {
    const b = (i / 4) * TAU + 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, rc * 0.58, b, b + 0.95); ctx.arc(0, 0, rc * 0.3, b + 0.85, b + 0.1, true);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // hub
  ctx.beginPath(); ctx.arc(0, 0, rc * 0.24, 0, TAU);
  ctx.fillStyle = BRASS_DK; ctx.fill();
  ctx.beginPath(); ctx.arc(-rc * 0.03, rc * 0.03, rc * 0.17, 0, TAU);
  ctx.fillStyle = BRASS_LT; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, rc * 0.08, 0, TAU);
  ctx.fillStyle = '#3a2406'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,250,220,0.85)'; ctx.lineWidth = 0.02; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, rc * 0.74, Math.PI * 0.6, Math.PI * 0.95); ctx.stroke();
  ctx.restore();
}

// While the player turns a geared ring, every other ring of its train shows a brass arrow the way it is
// being turned, so the link is never a surprise. strength 0..1 fades it in and out.
export function drawGearArrow(ctx, ring, dir, strength, t) {
  if (strength <= 0.02) return;
  // just right of the top of the ring: always on screen, away from the idler cogs (left of the top)
  const r = ring.r, span = Math.min(0.9, 2.2 / r), a0 = Math.PI / 2 - 0.3 - span / 2 + ((t * dir * 0.5) % 0.25);
  ctx.save();
  ctx.globalAlpha = Math.min(1, strength);
  ctx.lineCap = 'round';
  for (const [lw, c] of [[0.2, BRASS_DK], [0.12, BRASS_LT]]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, 0, r, a0 - span / 2, a0 + span / 2);
    ctx.stroke();
    // head at the leading end (dir > 0: counter-clockwise in world space)
    const ah = a0 + (dir * span) / 2, tx = -Math.sin(ah) * dir, ty = Math.cos(ah) * dir;
    const hx = r * Math.cos(ah), hy = r * Math.sin(ah), nx = Math.cos(ah), ny = Math.sin(ah), L = 0.3 + lw * 0.8;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(hx + tx * L * 0.9, hy + ty * L * 0.9);
    ctx.lineTo(hx + nx * L * 0.55, hy + ny * L * 0.55);
    ctx.lineTo(hx - nx * L * 0.55, hy - ny * L * 0.55);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// A stunned ring crackles with electric arcs.
function drawStun(ctx, ring, t, px) {
  ctx.save();
  const k = Math.floor(t * 20), bw = Math.max(1.4 * px, 0.016);
  const R = rng(k * 31 + ring.i);
  for (let j = 0; j < 6; j++) {
    const a = R() * TAU;
    ctx.beginPath();
    for (let q = 0; q < 5; q++) {
      const rr = ring.r + (R() - 0.5) * RING_TH * 1.6, b = a + q * 0.05;
      if (q) ctx.lineTo(rr * Math.cos(b), rr * Math.sin(b)); else ctx.moveTo(rr * Math.cos(b), rr * Math.sin(b));
    }
    boltStroke(ctx, bw, 1);
  }
  ctx.restore();
}

// Honey pads (F24): glossy amber on the inner face with drips. A pad holding an egg blinks before it
// lets go; a pad that just let go is dull for a moment.
function drawHoney(ctx, ring, px, t, stuck = []) {
  if (!ring.honey.length) return;
  const ri = ring.r - RING_TH / 2;
  ring.honey.forEach((h, k) => {
    const half = h.len / (2 * ring.r);
    const hold = stuck.find((e) => e.hold && e.hold.ri === ring.i && e.hold.pad === k);
    let a = h.dry > 0 && !hold ? 0.5 : 0.95;
    if (hold && hold.honey < 0.8) a = Math.sin(t * 28) > 0 ? 0.95 : 0.35;
    ctx.globalAlpha = a;
    annulus(ctx, ri - 0.07, ri + 0.01, h.a - half, h.a + half);
    ctx.fillStyle = '#e8920c';
    ctx.fill();
    annulus(ctx, ri - 0.07, ri - 0.045, h.a - half * 0.9, h.a + half * 0.9);
    ctx.fillStyle = 'rgba(255,226,140,0.85)';
    ctx.fill();
    // drips
    ctx.fillStyle = '#d97a06';
    const n = Math.max(2, Math.round(h.len / 0.22));
    for (let i = 0; i < n; i++) {
      const b = h.a - half + ((i + 0.5) / n) * 2 * half;
      const len = 0.04 + 0.03 * (0.5 + 0.5 * Math.sin(t * 1.7 + i * 2.3));
      const x = (ri - 0.07) * Math.cos(b), y = (ri - 0.07) * Math.sin(b);
      ctx.beginPath();
      ctx.ellipse(x - Math.cos(b) * len * 0.5, y - Math.sin(b) * len * 0.5, 0.018, len * 0.6, b + Math.PI / 2, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}


function wrapA(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

// Living thorns (v3.3 M3), render only (the sim's thorn is unchanged): every thorn sways a little on its own beat,
// bristles and quivers when an egg comes close, stabs out when it breaks one, shivers just before a retracting
// thorn springs back out, and a burnt thorn chars, then crumbles into falling shards.
const TH_BITE = new Map(); // thorn key -> render time of its last bite
const crumbles = []; // burnt thorns: { ring, a, base, tip, out, t0 }
export function thornBite(sim, x, y, t) {
  let best = null, bd = 0.9;
  for (const ring of sim.rings) {
    const A = ring.body.getAngle();
    for (const th of ring.thorns) {
      if (!th.alive) continue;
      const [lx, ly] = ringPt(ring, th.a, th.tip), d = Math.hypot(lx * Math.cos(A) - ly * Math.sin(A) - x, lx * Math.sin(A) + ly * Math.cos(A) - y);
      if (d < bd) { bd = d; best = th; }
    }
  }
  if (best) TH_BITE.set(best.key, t);
}
export function thornCrumble(th, t) {
  if (th && th.ring) crumbles.push({ ring: th.ring, a: th.a, base: th.base, tip: th.tip, out: th.tip > th.base, t0: t });
  if (crumbles.length > 40) crumbles.shift();
}
function drawCrumbles(ctx, ring, t, px) {
  const A = ring.body.getAngle(), dx = -Math.sin(A), dy = -Math.cos(A); // world down, in ring space
  for (let i = crumbles.length - 1; i >= 0; i--) {
    const c = crumbles[i];
    if (c.ring !== ring) continue;
    const age = t - c.t0;
    if (age > 1.4 || age < 0) { crumbles.splice(i, 1); continue; }
    const half = 0.13 / ringSpd(ring, c.a), P = (rad, an) => ringPt(ring, an, rad);
    if (age < 0.45) {
      // charring husk: orange glow fading to black, embers along the edge
      const u = age / 0.45, [x0, y0] = P(c.base, c.a - half), [x1, y1] = P(c.base, c.a + half), [x2, y2] = P(c.base + (c.tip - c.base) * (1 - 0.15 * u), c.a);
      const [gx, gy] = P(c.base + (c.tip - c.base) * 0.5, c.a), gl = ctx.createRadialGradient(gx, gy, 0, gx, gy, 0.3);
      gl.addColorStop(0, `rgba(255,150,50,${(0.8 * (1 - u)).toFixed(3)})`);
      gl.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.arc(gx, gy, 0.3, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x2, y2); ctx.lineTo(x1, y1); ctx.closePath();
      ctx.fillStyle = `rgb(${Math.round(210 - 170 * u)},${Math.round(90 - 70 * u)},${Math.round(40 - 25 * u)})`;
      ctx.fill();
      ctx.lineWidth = Math.max(2 * px, 0.02);
      ctx.strokeStyle = '#1a0a06';
      ctx.stroke();
      for (let k = 0; k < 3; k++) {
        const f = 0.25 + 0.25 * k, ex = x0 + (x2 - x0) * f, ey = y0 + (y2 - y0) * f;
        ctx.beginPath();
        ctx.arc(ex, ey, 0.018 * (1 - u) + 0.006, 0, TAU);
        ctx.fillStyle = Math.sin(t * 30 + k) > 0 ? '#ffd27a' : '#ff6a1a';
        ctx.fill();
      }
      continue;
    }
    // shards: three dark pieces tumble down and fade
    const u = (age - 0.45) / 0.95;
    for (let k = 0; k < 3; k++) {
      const f = 0.2 + 0.3 * k, rr = c.base + (c.tip - c.base) * f, [sx, sy] = P(rr, c.a + (k - 1) * half * 0.6);
      // each shard pops up and out to the side (clear of the egg that burnt it), then falls
      const s = age - 0.45, g = 9 * s * s - 1.6 * s, side = (k - 1 || 0.6) * 1.1 * s;
      const x = sx + dx * g - dy * side, y = sy + dy * g + dx * side, sz = 0.075 * (1 - 0.3 * k / 2);
      ctx.save();
      ctx.globalAlpha = 1 - u;
      ctx.translate(x, y);
      ctx.rotate((age - 0.45) * (k - 1 || 1) * 9);
      ctx.beginPath();
      ctx.moveTo(-sz, -sz * 0.6); ctx.lineTo(sz, 0); ctx.lineTo(-sz * 0.4, sz * 0.7); ctx.closePath();
      ctx.fillStyle = '#2a1712';
      ctx.fill();
      ctx.lineWidth = Math.max(1.5 * px, 0.014);
      ctx.strokeStyle = u < 0.5 ? '#ff7a2a' : '#5a2a18';
      ctx.stroke();
      ctx.restore();
    }
  }
}

// Thorn colours per world, picked by contrast (mykee: red thorns vanish on red or dark backdrops). Light worlds keep
// the classic red thorn; dark, red or pink worlds get pale bone thorns with a red tip, so the danger colour stays
// but the shape pops. Blunt spikes go dark steel on grey rings so they never melt into stone or metal.
const TH_RED = { fill: '#d23a3a', edge: '#3a0d0d', hl: 'rgba(255,220,200,0.8)', tip: null, tint: 0.35 };
const TH_BONE = { fill: '#f6ecd6', edge: '#1c0809', hl: 'rgba(255,255,255,0.95)', tip: '#ff2e4a', tint: 0 };
const TH_LOOK = new Map();
const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [0.5, 0.5, 0.5]; const n = parseInt(m[1], 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const luma = (h) => { const [r, g, b] = hexRgb(h).map((v) => (v <= 0.04 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const reddish = (h) => { const [r, g, b] = hexRgb(h); return r > 0.45 && r > g * 1.45 && r > b * 1.25; }; // red or pink
const sunset = (h) => { const [r, g, b] = hexRgb(h); return r > 0.7 && r > g * 1.15 && b < 0.5; }; // an orange sky
export function thornLook(theme, mat) {
  const key = (theme?.id || '') + '|' + (mat || '');
  let L = TH_LOOK.get(key);
  if (L) return L;
  const P = theme?.palette || {}, ring = RING_MAT_BASE[mat] || P.ring?.base || '#8f8a83';
  const bg = (luma(P.skyTop) + luma(P.skyBottom)) / 2;
  const bone = bg < 0.12 || luma(ring) < 0.05 || reddish(P.skyTop) || reddish(P.skyBottom) || sunset(P.skyTop) || sunset(P.skyBottom) || reddish(ring) || reddish(P.ground);
  const [r, g, b] = hexRgb(ring), grey = Math.max(r, g, b) - Math.min(r, g, b) < 0.12;
  L = { ...(bone ? TH_BONE : TH_RED), blunt: grey ? ['#4a515b', '#14171b', 'rgba(220,230,240,0.85)'] : ['#8d939b', '#2f3338', 'rgba(235,240,245,0.7)'] };
  TH_LOOK.set(key, L);
  return L;
}
export const RING_MAT_BASE = { wood: '#b9854e', stone: '#8f8a83', ice: '#8fcbea', glass: '#5ec9c4', metal: '#8f99a5', cloud: '#aab3c6', obsidian: '#3b3443', vine: '#4f8a3a', mushroom: '#c2508f', coral: '#ec6f61', bone: '#cfc4ab', gold: '#d6a12c', brass: '#b8873a' };

function drawThorns(ctx, ring, theme, px, t = 0, opts = {}) {
  const c = theme?.palette?.thorn || '#3a2a2a', look = thornLook(theme, ring.mat);
  const A = ring.body.getAngle(), eggs = opts.eggs || [];
  const soft = ring.mat === 'vine' || ring.mat === 'wood' || !ring.mat;
  const calm = isSpriteCalm();
  const lcx = LIGHT.x * Math.cos(-A) - LIGHT.y * Math.sin(-A), lcy = LIGHT.x * Math.sin(-A) + LIGHT.y * Math.cos(-A); // the light, in ring space
  const sdx = 0.035 * Math.cos(-A) + 0.07 * Math.sin(-A), sdy = 0.035 * Math.sin(-A) - 0.07 * Math.cos(-A); // shadow offset (world down-right), in ring space
  // a retracting ring: how long until its thorns spring back out (they shiver for the last 0.5 s)
  let comeback = 9;
  if (ring.retract && opts.simT != null) {
    const { period, on, phase = 0 } = ring.retract, ph = ((((opts.simT + phase) % period) + period) % period) / period;
    if (ph >= on) comeback = (1 - ph) * period;
  }
  for (const th of ring.thorns) {
    if (!th.alive) continue;
    // an egg close by: the thorn bristles (reaches a little further) and quivers
    let near = 0;
    if (eggs.length) {
      const [lx, ly] = ringPt(ring, th.a, th.tip), tx = lx * Math.cos(A) - ly * Math.sin(A), ty = lx * Math.sin(A) + ly * Math.cos(A);
      for (const p of eggs) near = Math.max(near, clamp01(1 - (Math.hypot(p.x - tx, p.y - ty) - 0.35) / 0.9));
    }
    const bt = TH_BITE.get(th.key), bite = bt != null ? clamp01(1 - (t - bt) / 0.4) : 0;
    const shiver = ring.retract && th.ext < 0.5 && comeback < 0.5 ? 1 - comeback / 0.5 : 0;
    const k0 = th.key * 0.73;
    const sway = (soft ? 0.07 : 0.04) * Math.sin(t * 1.6 + k0) + near * 0.07 * Math.sin(t * 31 + k0) + shiver * 0.1 * Math.sin(t * 45 + k0) + bite * 0.12 * Math.sin(t * 60);
    const e = Math.min(1.25, 0.25 + 0.75 * th.ext + 0.1 * near + 0.3 * bite * Math.sin(Math.PI * Math.min(1, (t - (bt || 0)) / 0.2)) + 0.3 * shiver);
    const half = 0.13 / ringSpd(ring, th.a);
    const tip = th.base + (th.tip - th.base) * e;
    const a = th.a, na = ringNormal(ring, a); // v3.3 M10: a shaped ring's thorn stands on the surface normal
    const P = (rad, an) => ringPt(ring, an, rad);
    const [x0, y0] = P(th.base, a - half), [x1, y1] = P(th.base, a + half);
    let [x2, y2] = P(tip, a);
    if (shiver > 0) {
      // about to spring out: the stub's tip glows hot so the player sees the warning, not just a twitch
      const gl = ctx.createRadialGradient(x2, y2, 0, x2, y2, 0.16);
      gl.addColorStop(0, `rgba(255,120,60,${(0.75 * shiver * (0.65 + 0.35 * Math.sin(t * 24 + k0))).toFixed(3)})`);
      gl.addColorStop(1, 'rgba(255,60,30,0)');
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.arc(x2, y2, 0.16, 0, TAU);
      ctx.fill();
    }
    // sway bends the tip sideways (tangentially), the base stays planted
    const L = Math.abs(tip - th.base);
    x2 += -Math.sin(na) * L * sway; y2 += Math.cos(na) * L * sway;
    const [mx, my] = P(th.base + (tip - th.base) * 0.45, a);
    const bx = (x0 + x1) / 2, by = (y0 + y1) / 2;
    // which flank faces the light (world top-left)? that facet is lit, the other falls into shade
    const litA = (x0 - x1) * lcx + (y0 - y1) * lcy > 0;
    const blunt = th.kind === 'blunt';
    const fill = blunt ? look.blunt[0] : look.fill, edge = blunt ? look.blunt[1] : look.edge;
    const lit = blunt || look.tip ? lighten(fill, blunt ? 0.4 : 0.6) : mix(fill, '#ff8a5c', 0.55), shade = look.tint && !blunt ? mix(darken(fill, 0.3), c, look.tint) : mix(fill, look.tip && !blunt ? '#8a6f52' : '#000000', look.tip && !blunt ? 0.55 : 0.36);
    let t0x, t0y, t1x, t1y;
    if (blunt) { [t0x, t0y] = P(tip, a - half * 0.35); [t1x, t1y] = P(tip, a + half * 0.35); }
    const shape = (ox, oy) => {
      ctx.beginPath();
      ctx.moveTo(x0 + ox, y0 + oy);
      if (blunt) {
        // blunt grey spike: a stubby cone with a rounded tip (cracks, never breaks)
        ctx.lineTo(t0x + ox, t0y + oy);
        ctx.quadraticCurveTo(x2 + (x2 - mx) * 0.25 + ox, y2 + (y2 - my) * 0.25 + oy, t1x + ox, t1y + oy);
      } else {
        // a curved, hooked silhouette drawn to a needle point
        ctx.quadraticCurveTo(mx + (y1 - y0) * 0.14 + ox, my - (x1 - x0) * 0.14 + oy, x2 + ox, y2 + oy);
        ctx.quadraticCurveTo(mx - (y1 - y0) * 0.06 + ox, my + (x1 - x0) * 0.06 + oy, x1 + ox, y1 + oy);
      }
      ctx.lineTo(x1 + ox, y1 + oy);
      ctx.closePath();
    };
    // cast shadow, then the root collar where it grows out of the ring
    shape(sdx, sdy);
    ctx.fillStyle = 'rgba(10,4,14,0.3)';
    ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.07;
    ctx.beginPath(); ctx.moveTo(x0 + (x1 - x0) * 0.12, y0 + (y1 - y0) * 0.12); ctx.lineTo(x1 + (x0 - x1) * 0.12, y1 + (y0 - y1) * 0.12); ctx.stroke();
    // body: outline under, then two facets meeting on a ridge that runs from the root to the point
    shape(0, 0);
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 8;
    ctx.lineWidth = Math.max(2.6 * px, 0.036);
    ctx.strokeStyle = edge;
    ctx.stroke();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const rx = blunt ? x2 : x2 * 0.92 + mx * 0.08, ry = blunt ? y2 : y2 * 0.92 + my * 0.08;
    for (const side of [0, 1]) {
      const ex = side ? x1 : x0, ey = side ? y1 : y0, isLit = side ? !litA : litA;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(ex + (ex - bx) * 0.6, ey + (ey - by) * 0.6);
      ctx.lineTo(x2 + (ex - bx) * 0.8 + (x2 - bx) * 0.3, y2 + (ey - by) * 0.8 + (y2 - by) * 0.3);
      ctx.lineTo(rx + (x2 - bx) * 0.3, ry + (y2 - by) * 0.3);
      ctx.closePath();
      ctx.fillStyle = isLit ? lit : shade;
      ctx.fill();
    }
    if (look.tip && !blunt) {
      // bone thorns keep a blood-red point: the danger colour, on a shape that pops
      ctx.beginPath();
      ctx.moveTo(x0 + (x2 - x0) * 0.56, y0 + (y2 - y0) * 0.56);
      ctx.lineTo(x2 + (x2 - bx) * 0.3, y2 + (y2 - by) * 0.3);
      ctx.lineTo(x1 + (x2 - x1) * 0.56, y1 + (y2 - y1) * 0.56);
      ctx.closePath();
      ctx.fillStyle = look.tip;
      ctx.fill();
      const lx0 = litA ? x0 : x1, ly0 = litA ? y0 : y1;
      ctx.beginPath();
      ctx.moveTo(lx0 + (x2 - lx0) * 0.56, ly0 + (y2 - ly0) * 0.56);
      ctx.lineTo(x2, y2);
      ctx.lineTo(bx + (x2 - bx) * 0.56, by + (y2 - by) * 0.56);
      ctx.closePath();
      ctx.fillStyle = lighten(look.tip, 0.35);
      ctx.fill();
    }
    ctx.restore();
    // a hard glint down the lit edge, and now and then the point itself catches the light
    const gx = litA ? x0 : x1, gy = litA ? y0 : y1, tx = blunt ? (litA ? t0x : t1x) : x2, ty = blunt ? (litA ? t0y : t1y) : y2;
    ctx.strokeStyle = look.hl;
    ctx.lineWidth = Math.max(px, 0.014);
    ctx.beginPath();
    ctx.moveTo(gx * 0.72 + tx * 0.28 + (bx - gx) * 0.22, gy * 0.72 + ty * 0.28 + (by - gy) * 0.22);
    ctx.lineTo(gx * 0.3 + tx * 0.7 + (bx - gx) * 0.12, gy * 0.3 + ty * 0.7 + (by - gy) * 0.12);
    ctx.stroke();
    if (!blunt && !calm) {
      const tw = ((t * 0.45 + ((th.key * 0.618) % 1) + 1) % 1) * 9; // each point twinkles for a moment every couple of seconds
      if (tw < 1) {
        const s = Math.sin(Math.PI * tw) * 0.075;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x2 - s, y2); ctx.quadraticCurveTo(x2, y2, x2, y2 + s); ctx.quadraticCurveTo(x2, y2, x2 + s, y2); ctx.quadraticCurveTo(x2, y2, x2, y2 - s); ctx.quadraticCurveTo(x2, y2, x2 - s, y2);
        ctx.fill();
      }
    }
  }
  if (crumbles.length) drawCrumbles(ctx, ring, t, px);
}

// Eggs are the heroes: a lit shell (form shadow, bounce light, specular, heavier line on the shadow side), a contact
// shadow on whatever it rests on, a face that reads at phone scale, and squash and stretch driven purely by the
// velocity the sim already has (render-only state, the body is untouched).
export const EGG_DRAW = 1.06; // drawn a touch larger than the hull; the outline sits on the contact line
const EGG_FX = new WeakMap(); // egg -> { vx, vy, t, amp, ang, t0 }
function eggDeform(egg, v, t) {
  let F = EGG_FX.get(egg);
  if (!F) { EGG_FX.set(egg, (F = { vx: v.x, vy: v.y, t, amp: 0, ang: 0, t0: -9 })); return null; }
  const dt = t - F.t;
  if (dt > 0 && dt < 0.1) {
    const dx = v.x - F.vx, dy = v.y - F.vy, dv = Math.hypot(dx, dy);
    if (dv > 1.6 && dv / dt > 60) { F.amp = Math.min(1, dv / 6); F.ang = Math.atan2(dy, dx); F.t0 = t; } // an impact: a sudden change of velocity
  }
  if (dt !== 0) { F.vx = v.x; F.vy = v.y; F.t = t; }
  if (isSpriteCalm()) return null;
  const age = t - F.t0;
  if (age >= 0 && age < 0.5) {
    const s = F.amp * 0.2 * Math.exp(-age * 9) * Math.cos(age * 26);
    if (Math.abs(s) > 0.004) return { ang: F.ang, s: 1 - s };
  }
  const sp = Math.hypot(v.x, v.y);
  if (Math.abs(v.y) > 3 && sp > 3.4) return { ang: Math.atan2(v.y, v.x), s: 1 + Math.min(0.11, (sp - 3.4) * 0.035) }; // a fast fall stretches
  return null;
}
function shellGradient(ctx, c0, c1, c2, c3) {
  const g = ctx.createRadialGradient(-0.085, 0.12, 0.015, -0.02, 0.02, 0.36);
  g.addColorStop(0, c0); g.addColorStop(0.42, c1); g.addColorStop(0.78, c2); g.addColorStop(1, c3);
  return g;
}

export function drawEgg(ctx, egg, t, k) {
  const b = egg.body;
  const p = b.getPosition();
  const a = b.getAngle();
  const px = 1 / k;
  if (egg.chick) {
    // hatched (gold flame): the chick flaps hard while it falls
    const v = b.getLinearVelocity();
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(px, -px); // helpers draw in pixels, y down
    drawChick(ctx, 0, 0, 0.5 * k, t, v.y < -0.3 ? 1 : 0.3, egg.peckK ? Math.min(1, (egg.peckT || 0) / 0.6) : 0); // v3: 1.5x inside drawChick; peck 0..1
    ctx.restore();
    return;
  }
  const v = b.getLinearVelocity();
  const sp = Math.hypot(v.x, v.y);
  // v3: special eggs are bigger/smaller; a badly cracked egg trembles
  const sc = egg.shrink > 0 ? SHRINK_S : KIND_S[egg.kind] || 1; // v3.4: a shrunk egg is quail size
  const ds = sc * EGG_DRAW;
  const rot = a + (egg.cracks >= 2 ? Math.sin(t * 17 + egg.seed) * 0.05 : 0);
  const special = egg.kind && !(egg.stone > 0) && !egg.golden;
  // contact shadow: a soft dark pool on the surface under a resting or rolling egg (toward the ring below it)
  if (sp < 2.6) {
    const d = Math.hypot(p.x, p.y), up = d > 0.01 ? Math.max(0, p.y / d) : 0;
    let nx = d > 0.3 ? p.x / d : 0, ny = d > 0.3 ? p.y / d : -1;
    nx = nx * (1 - up); ny = ny * (1 - up) - up; // upper half of the vault: the support is below, not outward
    const nl = Math.hypot(nx, ny) || 1, na = Math.atan2(ny / nl, nx / nl), f = 1 - sp / 2.6;
    ctx.save();
    ctx.translate(p.x + (nx / nl) * 0.215 * sc, p.y + (ny / nl) * 0.215 * sc);
    ctx.rotate(na);
    ctx.fillStyle = `rgba(14,6,18,${(0.2 * f).toFixed(3)})`;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.085 * sc, 0.27 * sc, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(14,6,18,${(0.3 * f).toFixed(3)})`;
    ctx.beginPath(); ctx.ellipse(0.012 * sc, 0, 0.05 * sc, 0.2 * sc, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  const D = null; // squash and stretch come from the feel layer in main.js (one source, driven by real impacts)
  if (D) { ctx.rotate(D.ang); ctx.scale(D.s, 1 / D.s); ctx.rotate(-D.ang); }
  ctx.save();
  ctx.scale(ds, ds);
  // shell: the path turns with the egg, the light stays put (top-left)
  ctx.rotate(rot);
  eggPath(ctx);
  ctx.rotate(-rot);
  if (egg.stone > 0) ctx.fillStyle = shellGradient(ctx, '#f1eee6', '#b3afa6', '#7d7a74', '#4a4743');
  else if (egg.golden) ctx.fillStyle = shellGradient(ctx, '#fffbe0', '#ffd95a', '#f0a81c', '#a8690a');
  else if (egg.fire > 0) ctx.fillStyle = shellGradient(ctx, '#fffaf0', '#ffe2b8', '#ffc078', '#d9762e');
  else ctx.fillStyle = shellGradient(ctx, '#fffaf0', '#fbeed6', '#efd9b4', '#cfae80');
  ctx.fill();
  ctx.rotate(rot);
  if (special) {
    ctx.save();
    ctx.scale(px / ds, -px / ds);
    drawEggKind(ctx, egg.kind, 0, 0, (EGG_W / 2) * ds * k, (EGG_H / 2) * ds * k, 0, t, egg.cracks); // shell + its own cracks
    ctx.restore();
  } else if (skin !== 'classic' && !(egg.stone > 0) && !egg.golden && !egg.fire) {
    ctx.save();
    ctx.scale(px / ds, -px / ds);
    drawSkinPreview(ctx, skin, 0, 0, EGG_H * ds * k, t);
    ctx.restore();
  }
  if (egg.prize) {
    // gold speckles: the prize egg of a 'save the speckled egg' bonus
    const R = rng(egg.seed);
    for (let i = 0; i < 14; i++) {
      const q = eggPoint(R() * TAU), f = 0.2 + 0.7 * R();
      ctx.fillStyle = i % 3 ? '#d9a21c' : '#f4c64a';
      ctx.beginPath();
      ctx.arc(q.x * f, q.y * f, 0.016, 0, TAU);
      ctx.fill();
    }
  }
  if (egg.honey > 0) {
    eggPath(ctx, 1.08);
    ctx.fillStyle = 'rgba(232,146,12,0.35)';
    ctx.fill();
  }
  // v3 cracks (G34): a bold cartoon zig-zag across the top of the shell. 1 = half way across,
  // 2 = all the way plus a crack down the side, a missing chip and a tremble.
  if (egg.cracks > 0 && !special) {
    const n = Math.min(egg.cracks, 3), m = egg.seed & 1 ? 1 : -1, y = 0.12;
    const zig = [];
    const x1 = n >= 2 ? 0.2 : 0.05;
    for (let i = 0, N = n >= 2 ? 8 : 5; i <= N; i++) { const x = -0.2 + ((x1 + 0.2) * i) / N; zig.push([m * x, y + (i % 2 ? 0.045 : -0.025) + (i === N ? 0.01 : 0)]); }
    const side = [[m * 0.11, y + 0.02], [m * 0.15, y - 0.06], [m * 0.12, y - 0.1], [m * 0.17, y - 0.19]];
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.save();
    eggPath(ctx);
    ctx.clip();
    if (n >= 2) {
      ctx.fillStyle = 'rgba(80,50,25,0.14)';
      ctx.fillRect(-0.3, -0.35, 0.6, 0.7);
      ctx.beginPath();
      ctx.moveTo(m * -0.07, y + 0.035);
      ctx.lineTo(m * 0.0, y + 0.115);
      ctx.lineTo(m * 0.06, y + 0.03);
      ctx.lineTo(m * 0.0, y - 0.01);
      ctx.closePath();
      ctx.fillStyle = '#3a2210';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,250,235,0.9)'; ctx.lineWidth = 0.012; ctx.stroke();
    }
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? '#3a2210' : 'rgba(255,250,235,0.95)';
      ctx.lineWidth = pass ? Math.max(2.4 * px, 0.026) : Math.max(4.6 * px, 0.05);
      ctx.beginPath();
      zig.forEach(([x, yy], j) => (j ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)));
      if (n >= 2) side.forEach(([x, yy], j) => (j ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)));
      ctx.stroke();
    }
    ctx.restore();
  }
  // v3: the curse tints the shell violet
  if (egg.curse > 0) {
    eggPath(ctx);
    ctx.fillStyle = `rgba(150,60,210,${0.22 + 0.08 * Math.sin(t * 9)})`;
    ctx.fill();
  }
  // lighting over whatever the shell wears: form shadow on the far side, warm bounce on the lower rim, specular
  ctx.save();
  eggPath(ctx);
  ctx.clip();
  ctx.rotate(-rot);
  const sh = ctx.createRadialGradient(-0.1, 0.13, 0.12, -0.03, 0.03, 0.4);
  sh.addColorStop(0, 'rgba(70,30,20,0)'); sh.addColorStop(0.55, 'rgba(70,30,20,0.04)'); sh.addColorStop(0.85, egg.stone > 0 ? 'rgba(20,16,20,0.34)' : 'rgba(96,48,26,0.3)'); sh.addColorStop(1, egg.stone > 0 ? 'rgba(20,16,20,0.5)' : 'rgba(96,48,26,0.44)');
  ctx.fillStyle = sh;
  ctx.fillRect(-0.4, -0.4, 0.8, 0.8);
  // bounce light: a thin warm rim low on the shadow side
  const rim = ctx.createLinearGradient(-0.12, 0.16, 0.14, -0.2);
  rim.addColorStop(0, 'rgba(255,244,220,0)'); rim.addColorStop(0.62, 'rgba(255,244,220,0)'); rim.addColorStop(1, 'rgba(255,244,220,0.75)');
  ctx.rotate(rot);
  eggPath(ctx, 0.93);
  ctx.rotate(-rot);
  ctx.strokeStyle = rim;
  ctx.lineWidth = 0.028;
  ctx.stroke();
  // specular: one crisp window highlight and its little echo
  ctx.fillStyle = egg.stone > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.95)';
  ctx.save();
  ctx.translate(-0.088, 0.125);
  ctx.rotate(0.62);
  ctx.beginPath(); ctx.ellipse(0, 0, 0.026, 0.058, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(-0.128, 0.04, 0.013, 0, TAU); ctx.fill();
  ctx.restore();
  // outline: warm dark, heavier on the shadow side
  eggPath(ctx);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = egg.stone > 0 ? '#2b2926' : egg.golden ? '#7a4a08' : '#6b4526';
  ctx.lineWidth = Math.max(1.5 * px, 0.02) / ds;
  ctx.stroke();
  ctx.rotate(-rot);
  const ol = ctx.createLinearGradient(-0.1, 0.14, 0.12, -0.18);
  ol.addColorStop(0, 'rgba(60,34,18,0)'); ol.addColorStop(0.5, 'rgba(60,34,18,0)'); ol.addColorStop(1, egg.stone > 0 ? 'rgba(20,18,16,0.9)' : 'rgba(74,40,20,0.9)');
  ctx.strokeStyle = ol;
  ctx.lineWidth = Math.max(2.4 * px, 0.034) / ds;
  ctx.stroke();
  ctx.rotate(rot);
  if (egg.glow > 0) {
    eggPath(ctx, 1.1);
    ctx.strokeStyle = `rgba(110,255,120,${Math.min(1, egg.glow)})`;
    ctx.lineWidth = 0.035;
    ctx.stroke();
  }
  // the guardian feather wraps it in a cool shimmer
  if (egg.guard > 0) {
    eggPath(ctx, 1.16);
    ctx.strokeStyle = `rgba(140,230,255,${egg.guard < 1.5 ? 0.4 + 0.4 * Math.sin(t * 20) : 0.85})`;
    ctx.lineWidth = Math.max(2.5 * px, 0.03);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();

  // power overlay (powers.js, local y-down): flames stay upright, shells turn with the egg
  const pw = egg.fire > 0 ? egg.fireKind : egg.iron && egg.stone > 0 ? 'iron' : egg.rockskin > 0 && egg.stone > 0 ? 'rockskin' : egg.stone > 0 ? 'stone' : egg.bubbleFix ? 'bubble' : egg.water > 0 ? 'water' : egg.zap ? 'thunder' : egg.golden ? 'golden' : null;
  if (pw) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (egg.fire <= 0) ctx.rotate(a);
    ctx.scale(px, -px);
    drawEggPower(ctx, pw, t, EGG_H * k * ds);
    ctx.restore();
  }
  // v3 global-power overlays (art in powers.js)
  for (const id of [egg.guard > 0 && 'feather', egg.curse > 0 && 'curse', egg.shrink > 0 && 'shrink']) { // v3.4 shrink ray
    if (!id) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(px, -px);
    drawEggPower(ctx, id, t, EGG_H * k * ds);
    ctx.restore();
  }
  if (egg.zap) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const R = rng(Math.floor(t * 18) + egg.seed);
    for (let j = 0; j < 3; j++) {
      const b0 = R() * TAU;
      ctx.beginPath();
      for (let q = 0; q < 4; q++) { const rr = 0.3 + R() * 0.08, bb = b0 + q * 0.2; q ? ctx.lineTo(rr * Math.cos(bb), rr * Math.sin(bb)) : ctx.moveTo(rr * Math.cos(bb), rr * Math.sin(bb)); }
      boltStroke(ctx, Math.max(1.1 * px, 0.011), 1);
    }
    ctx.restore();
  }
  // face: big glossy eyes that read at phone scale; it leans a little with the roll, looks where the egg is going,
  // frets when the shell is cracked and gasps when it falls fast or something scares it
  ctx.save();
  ctx.translate(p.x, p.y);
  if (D) { ctx.rotate(D.ang); ctx.scale(D.s, 1 / D.s); ctx.rotate(-D.ang); }
  ctx.rotate(Math.sin(a) * 0.3);
  ctx.scale(ds, ds);
  const look = sp > 0.3 ? { x: (v.x / sp) * 0.022, y: (v.y / sp) * 0.02 } : { x: 0, y: 0 };
  const scared = sp > 3.2 || egg.fear > 0;
  const hurt = egg.cracks > 0 && !scared;
  const blink = !scared && Math.sin(t * 1.3 + egg.seed) > 0.985;
  const eyeY = 0.03, ex = 0.082, ink = egg.stone > 0 ? '#1c1a18' : '#2a1a10';
  ctx.lineCap = 'round';
  for (const sx of [-ex, ex]) {
    if (blink) {
      ctx.strokeStyle = ink; ctx.lineWidth = 0.02;
      ctx.beginPath(); ctx.arc(sx, eyeY + 0.02, 0.04, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      continue;
    }
    const rx = scared ? 0.05 : 0.043, ry = scared ? 0.066 : 0.056, cx = sx + look.x, cy = eyeY + look.y;
    if (scared) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(cx, cy, rx + 0.014, ry + 0.014, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.ellipse(cx, cy, scared ? rx * 0.8 : rx, scared ? ry * 0.8 : ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx - 0.014 - look.x * 0.4, cy + 0.02 - look.y * 0.4, scared ? 0.014 : 0.017, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 0.016, cy - 0.022, 0.007, 0, TAU); ctx.fill();
    if (hurt) { // worried brows
      ctx.strokeStyle = ink; ctx.lineWidth = 0.018;
      ctx.beginPath(); ctx.moveTo(sx - Math.sign(sx) * 0.035, eyeY + 0.105); ctx.lineTo(sx + Math.sign(sx) * 0.03, eyeY + 0.082); ctx.stroke();
    }
  }
  // cheeks
  ctx.fillStyle = egg.stone > 0 ? 'rgba(255,150,140,0.25)' : 'rgba(255,105,110,0.42)';
  ctx.beginPath();
  ctx.ellipse(-0.135, -0.04, 0.036, 0.026, 0, 0, TAU);
  ctx.ellipse(0.135, -0.04, 0.036, 0.026, 0, 0, TAU);
  ctx.fill();
  // mouth
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  if (egg.curse > 0) { /* the curse overlay draws its own grin */ }
  else if (scared) {
    ctx.ellipse(0, -0.075, 0.03, 0.04, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8606a'; ctx.beginPath(); ctx.ellipse(0, -0.092, 0.018, 0.016, 0, 0, TAU); ctx.fill();
  } else if (hurt) { ctx.moveTo(-0.036, -0.066); ctx.quadraticCurveTo(-0.018, -0.046, 0, -0.062); ctx.quadraticCurveTo(0.018, -0.078, 0.036, -0.058); ctx.stroke(); }
  else { ctx.arc(0, -0.022, 0.045, Math.PI * 1.22, Math.PI * 1.78); ctx.stroke(); }
  ctx.restore();
}

export function drawEggMult(ctx, egg, k, font) {
  // multiplier painted on the egg belly, screen-space-sized text inside the shell
  if (egg.mult <= 1) return;
  const p = egg.body.getPosition();
  ctx.save();
  ctx.translate(p.x, p.y - 0.15);
  ctx.scale(1 / k, -1 / k);
  const s = Math.max(10, Math.min(16, k * 0.16));
  ctx.font = `${s}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#6b3a00';
  ctx.strokeText('x' + egg.mult, 0, 0);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('x' + egg.mult, 0, 0);
  ctx.restore();
}

export function drawNest(ctx, sim, theme, t, savedCount) {
  const p = sim.nest.getPosition();
  const w = sim.nestW / 2;
  const straw = theme?.palette?.nestStraw || '#c9a24a';
  const dk = mix(straw, '#3a1e04', 0.62), line = mix(straw, '#2a1402', 0.82), lt = lighten(straw, 0.45);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // contact shadow on the ground
  ctx.fillStyle = 'rgba(10,6,14,0.22)';
  ctx.beginPath(); ctx.ellipse(0.04, -0.03, w + 0.3, 0.09, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(10,6,14,0.28)';
  ctx.beginPath(); ctx.ellipse(0.02, -0.02, w * 0.8, 0.055, 0, 0, TAU); ctx.fill();
  // the hollow: back of the rim and the dark inside
  ctx.beginPath(); ctx.ellipse(0, 0.47, w + 0.1, 0.13, 0, 0, TAU);
  ctx.fillStyle = mix(straw, '#160a02', 0.86); ctx.fill();
  ctx.strokeStyle = line; ctx.lineWidth = 0.17; ctx.stroke();
  ctx.strokeStyle = mix(straw, dk, 0.5); ctx.lineWidth = 0.12; ctx.stroke();
  // saved eggs nestled inside
  const n = Math.min(4, savedCount);
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate(-0.33 + i * 0.22, 0.34 + (i % 2) * 0.04);
    ctx.scale(0.78, 0.78);
    const rot = (i - 1.5) * 0.25;
    ctx.rotate(rot);
    eggPath(ctx);
    ctx.rotate(-rot);
    ctx.fillStyle = shellGradient(ctx, '#ffffff', '#fff6e4', '#f3e0be', '#d3b488');
    ctx.fill();
    ctx.strokeStyle = '#6b4526';
    ctx.lineWidth = 0.028;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.ellipse(-0.085, 0.13, 0.024, 0.05, 0.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // bowl: lit from the top-left, falling into shade underneath
  const bowl = () => {
    ctx.beginPath();
    ctx.moveTo(-w - 0.13, 0.5);
    ctx.bezierCurveTo(-w - 0.1, 0.1, -w * 0.55, -0.05, 0, -0.05);
    ctx.bezierCurveTo(w * 0.55, -0.05, w + 0.1, 0.1, w + 0.13, 0.5);
    ctx.quadraticCurveTo(0, 0.36, -w - 0.13, 0.5);
    ctx.closePath();
  };
  bowl();
  ctx.strokeStyle = line; ctx.lineWidth = 0.05; ctx.stroke();
  const g = ctx.createLinearGradient(0, 0.5, 0, -0.05);
  g.addColorStop(0, lighten(straw, 0.22)); g.addColorStop(0.4, straw); g.addColorStop(1, mix(straw, '#2e1602', 0.72));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // woven straw: two families of strands crossing, light over dark
  const r = rng(11);
  for (let i = 0; i < 34; i++) {
    const x0 = -w - 0.2 + r() * (2 * w + 0.3), y0 = 0.0 + r() * 0.46, dir = i % 2 ? 1 : -1, L = 0.3 + r() * 0.3;
    for (const [c, lw, off] of [[mix(straw, '#3a1e04', 0.7, 0.7), 0.04, -0.016], [i % 3 ? lighten(straw, 0.55, 0.9) : lighten(straw, 0.25, 0.8), 0.022, 0]]) {
      ctx.strokeStyle = c; ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + off);
      ctx.quadraticCurveTo(x0 + L * 0.5, y0 + off - 0.05, x0 + L, y0 + off + dir * 0.09 * r());
      ctx.stroke();
    }
  }
  const sd = ctx.createLinearGradient(-w, 0, w, 0);
  sd.addColorStop(0, 'rgba(255,244,200,0.22)'); sd.addColorStop(0.4, 'rgba(255,244,200,0)'); sd.addColorStop(1, 'rgba(50,22,0,0.38)');
  ctx.fillStyle = sd;
  ctx.fillRect(-w - 0.3, -0.1, 2 * w + 0.6, 0.7);
  ctx.restore();
  // front of the rim: a fat twisted rope of straw
  ctx.beginPath(); ctx.ellipse(0, 0.47, w + 0.1, 0.13, 0, Math.PI, TAU);
  ctx.strokeStyle = line; ctx.lineWidth = 0.2; ctx.stroke();
  ctx.strokeStyle = lighten(straw, 0.16); ctx.lineWidth = 0.15; ctx.stroke();
  ctx.strokeStyle = mix(straw, '#4a2806', 0.6, 0.85); ctx.lineWidth = 0.145;
  ctx.setLineDash([0.025, 0.1]); ctx.lineCap = 'butt'; ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(0, 0.515, w + 0.09, 0.13, 0, Math.PI * 1.06, Math.PI * 1.6);
  ctx.strokeStyle = lighten(lt, 0.4, 0.85); ctx.lineWidth = 0.03; ctx.stroke();
  // a few stray straws
  ctx.strokeStyle = line; ctx.lineWidth = 0.04;
  const stray = [[-w - 0.12, 0.44, -0.16, 0.1], [w + 0.1, 0.42, 0.17, 0.08], [-w * 0.6, 0.02, -0.14, -0.03], [w * 0.7, 0.05, 0.13, -0.02]];
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass ? lighten(straw, 0.3) : line; ctx.lineWidth = pass ? 0.02 : 0.045;
    ctx.beginPath();
    for (const [x, y, ddx, ddy] of stray) { ctx.moveTo(x, y); ctx.lineTo(x + ddx, y + ddy); }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPortal(ctx, x, y, t, out) {
  const c1 = out ? '#ff9a3c' : '#7c5cff';
  const c2 = out ? '#ffd27a' : '#45d3ff';
  ctx.save();
  ctx.translate(x, y);
  // the well: deep centre, a lit lip
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.46);
  g.addColorStop(0, '#020108');
  g.addColorStop(0.5, out ? '#2a0f06' : '#140c2a');
  g.addColorStop(0.8, mix(c1, '#0a0618', 0.55));
  g.addColorStop(1, mix(c1, '#0a0618', 0.55, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 0.46, 0, TAU);
  ctx.fill();
  // spiral arms, fat at the rim and drawn to nothing at the centre
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const base = (out ? -1 : 1) * t * 2.6 + (i * TAU) / 4;
    ctx.strokeStyle = i % 2 ? c1 : c2;
    let px0 = 0, py0 = 0;
    for (let s = 0; s <= 14; s++) {
      const f = s / 14;
      const rr = 0.35 * (1 - f) + 0.03;
      const an = base + f * 3.4;
      const qx = rr * Math.cos(an), qy = rr * Math.sin(an);
      if (s) { ctx.lineWidth = 0.062 * (1 - f) + 0.008; ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(qx, qy); ctx.stroke(); }
      px0 = qx; py0 = qy;
    }
  }
  // rim: a solid ring of light with a dark seat and a hot inner edge
  ctx.strokeStyle = 'rgba(8,4,20,0.75)'; ctx.lineWidth = 0.1;
  ctx.beginPath(); ctx.arc(0, 0, 0.375, 0, TAU); ctx.stroke();
  const rg = ctx.createLinearGradient(-0.3, 0.3, 0.3, -0.3);
  rg.addColorStop(0, lighten(c2, 0.5)); rg.addColorStop(0.5, c1); rg.addColorStop(1, darken(c1, 0.45));
  ctx.strokeStyle = rg; ctx.lineWidth = 0.062;
  ctx.beginPath(); ctx.arc(0, 0, 0.375, 0, TAU); ctx.stroke();
  ctx.strokeStyle = lighten(c2, 0.6, 0.9); ctx.lineWidth = 0.014;
  ctx.beginPath(); ctx.arc(0, 0, 0.39, Math.PI * 0.55, Math.PI * 1.0); ctx.stroke();
  // sparks riding the rim
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    const an = (out ? 1 : -1) * t * 1.4 + (i * TAU) / 3, s = 0.016 + 0.01 * Math.sin(t * 7 + i * 2);
    ctx.beginPath(); ctx.arc(0.375 * Math.cos(an), 0.375 * Math.sin(an), s, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export function drawBomb(ctx, bomb, t) {
  const b = bomb.body, p = b.getPosition(), A = b.getAngle();
  const fl = bomb.lit ? 0.04 + 0.12 * Math.max(0, bomb.fuse / 2.5) : 0.16;
  ctx.save();
  ctx.translate(p.x, p.y);
  // contact shadow
  ctx.fillStyle = 'rgba(8,4,12,0.3)';
  ctx.beginPath(); ctx.ellipse(0.03, -0.19, 0.19, 0.06, 0, 0, TAU); ctx.fill();
  // cap and fuse turn with the body
  ctx.save();
  ctx.rotate(A);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 0.05;
  ctx.beginPath(); ctx.moveTo(0, 0.23); ctx.quadraticCurveTo(0.05, 0.23 + fl * 0.6, 0.08, 0.23 + fl); ctx.stroke();
  ctx.strokeStyle = '#e2c08a'; ctx.lineWidth = 0.028; ctx.stroke();
  ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 0.028; ctx.setLineDash([0.015, 0.03]); ctx.lineCap = 'butt'; ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#15171c';
  ctx.beginPath(); ctx.roundRect(-0.075, 0.15, 0.15, 0.1, 0.02); ctx.fill();
  ctx.fillStyle = '#5b6370';
  ctx.beginPath(); ctx.roundRect(-0.06, 0.165, 0.12, 0.07, 0.015); ctx.fill();
  ctx.fillStyle = '#a9b3c2';
  ctx.fillRect(-0.05, 0.205, 0.04, 0.02);
  ctx.restore();
  // body: a heavy iron ball, lit from the top-left
  ctx.beginPath();
  ctx.arc(0, 0, 0.2, 0, TAU);
  ctx.strokeStyle = '#07080b'; ctx.lineWidth = 0.035; ctx.stroke();
  const g = ctx.createRadialGradient(-0.075, 0.085, 0.01, -0.02, 0.02, 0.22);
  g.addColorStop(0, '#8b94a6');
  g.addColorStop(0.35, '#3b414d');
  g.addColorStop(0.8, '#15171d');
  g.addColorStop(1, '#2a2f3a');
  ctx.fillStyle = g;
  ctx.fill();
  if (bomb.lit && Math.sin(t * (12 + (2.5 - bomb.fuse) * 10)) > 0) {
    ctx.fillStyle = 'rgba(255,60,40,0.55)';
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.save(); ctx.translate(-0.085, 0.095); ctx.rotate(0.75); ctx.beginPath(); ctx.ellipse(0, 0, 0.022, 0.05, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(150,170,210,0.5)'; ctx.lineWidth = 0.016;
  ctx.beginPath(); ctx.arc(0, 0, 0.17, -Math.PI * 0.42, -Math.PI * 0.05); ctx.stroke();
  ctx.restore();
  return { x: p.x + 0.08 * Math.cos(A), y: p.y + 0.23 + fl };
}

export function drawRock(ctx, rock, theme) {
  const b = rock.body, p = b.getPosition(), A = b.getAngle();
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(8,4,12,0.28)';
  ctx.beginPath(); ctx.ellipse(0.03, -rock.s * 0.85, rock.s * 0.95, rock.s * 0.28, 0, 0, TAU); ctx.fill();
  ctx.rotate(A);
  const path = () => { ctx.beginPath(); rock.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); };
  path();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#23262b'; ctx.lineWidth = 0.05; ctx.stroke();
  ctx.fillStyle = '#7f858e';
  ctx.fill();
  // facets: each face of the boulder takes the light by the way it points (world top-left)
  const lx = LIGHT.x * Math.cos(-A) - LIGHT.y * Math.sin(-A), ly = LIGHT.x * Math.sin(-A) + LIGHT.y * Math.cos(-A), n = rock.pts.length;
  let cx = 0, cy = 0;
  for (const q of rock.pts) { cx += q.x / n; cy += q.y / n; }
  cx += lx * rock.s * 0.18; cy += ly * rock.s * 0.18;
  for (let i = 0; i < n; i++) {
    const q0 = rock.pts[i], q1 = rock.pts[(i + 1) % n], mx = (q0.x + q1.x) / 2 - cx, my = (q0.y + q1.y) / 2 - cy, d = (mx * lx + my * ly) / (Math.hypot(mx, my) || 1);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.closePath();
    ctx.fillStyle = d > 0 ? `rgba(255,255,255,${(0.42 * d).toFixed(3)})` : `rgba(10,12,22,${(-0.5 * d).toFixed(3)})`;
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(30,32,38,0.35)'; ctx.lineWidth = 0.012;
  ctx.beginPath();
  for (let i = 0; i < n; i += 2) { ctx.moveTo(cx, cy); ctx.lineTo(rock.pts[i].x, rock.pts[i].y); }
  ctx.stroke();
  ctx.restore();
}

export function drawDebris(ctx, d, theme) {
  const b = d.body, p = b.getPosition();
  const t = Math.min(1, d.life / 0.6);
  ctx.save();
  ctx.globalAlpha = t;
  ctx.translate(p.x, p.y);
  ctx.rotate(b.getAngle());
  ctx.beginPath();
  d.verts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  let fill = '#f3e8d2', stroke = 'rgba(90,64,40,0.8)';
  if (d.kind === 'shell') { fill = d.golden ? '#ffd34d' : '#f3e8d2'; }
  else if (d.kind === 'char') { fill = '#2a1a10'; stroke = '#ff6a1a'; }
  else if (d.kind === 'thorn') { fill = theme?.palette?.thorn || '#3a2a2a'; stroke = '#000'; }
  else { const c = MAT_COLORS[d.mat] || theme?.palette?.ring || DEFAULT_RING; fill = c.base; stroke = c.dark; }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 0.014;
  ctx.stroke();
  ctx.restore();
}

// The fuse: a rope circling the vault that burns down. v4: on a shaped vault (ring = the outer ring) it hugs the shape.
export function drawFuse(ctx, R, frac, t, fx, ring) {
  const start = Math.PI / 2;
  const end = start + TAU * frac;
  const shaped = ring && ring.prof, A = shaped ? ring.body.getAngle() : 0, off = shaped ? ring.r + RING_TH / 2 + (R - ringReach(ring)) : 0;
  const at = (wa) => { if (!shaped) return [R * Math.cos(wa), R * Math.sin(wa)]; const [x, y] = ringPt(ring, wa - A, off); return [x * Math.cos(A) - y * Math.sin(A), x * Math.sin(A) + y * Math.cos(A)]; };
  const path = (a0, a1) => {
    ctx.beginPath();
    if (!shaped) { ctx.arc(0, 0, R, a0, a1); return; }
    const n = Math.max(2, Math.ceil((a1 - a0) * 40));
    for (let i = 0; i <= n; i++) { const [x, y] = at(a0 + ((a1 - a0) * i) / n); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.09;
  path(start, start + TAU);
  ctx.stroke();
  if (frac > 0) {
    ctx.strokeStyle = frac < 0.2 ? '#ff5a3c' : '#e9d3a1';
    ctx.lineWidth = 0.06;
    path(start, end);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,80,30,0.7)';
    ctx.lineWidth = 0.015;
    ctx.setLineDash([0.06, 0.06]);
    path(start, end);
    ctx.stroke();
    ctx.setLineDash([]);
    const [x, y] = at(end);
    if (fx && Math.random() < 0.7) {
      fx.add({ x, y, vx: (Math.random() - 0.5) * 2.5, vy: Math.random() * 2.5, g: 5, life: 0.3 + Math.random() * 0.2, size: 0.02, color: '#ffd34d', type: 'spark' });
    }
    ctx.fillStyle = '#ffef9a';
    ctx.beginPath();
    ctx.arc(x, y, 0.05 + 0.015 * Math.sin(t * 30), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export { eggPath };

// Drop guide on the outermost ring: a chevron under each low gap, green when an egg falling
// out of it would land in the nest, faint white when it would miss.
export function drawDropGuide(ctx, ring, nestX, nestW, t) {
  const ang = ring.body.getAngle();
  for (const g of ring.gaps) {
    if ((g.curtain && g.curtain.alive) || g.grate) continue; // v3: not a way down for most eggs
    const th = ang + g.a;
    const s = Math.sin(th), c = Math.cos(th);
    if (s > -0.25) continue;
    const [gx, gy] = ringPt(ring, g.a, ring.r), x = gx * Math.cos(ang) - gy * Math.sin(ang);
    const over = Math.abs(x - nestX) < nestW / 2 - 0.12;
    const [lx, ly] = ringPt(ring, g.a, ring.r + 0.3), px = lx * Math.cos(ang) - ly * Math.sin(ang), py = lx * Math.sin(ang) + ly * Math.cos(ang);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(th - Math.PI / 2);
    const pulse = over ? 0.8 + 0.2 * Math.sin(t * 6) : 0.55;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = over ? '#6dff6a' : '#ff8a7a';
    ctx.strokeStyle = 'rgba(20,40,10,0.8)';
    ctx.lineWidth = 0.035;
    for (const off of [0, 0.17]) {
      ctx.beginPath();
      ctx.moveTo(-0.18, off);
      ctx.lineTo(0, off + 0.15);
      ctx.lineTo(0.18, off);
      ctx.lineTo(0, off + 0.07);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

// Falling embers and the lightning warning flicker.
export function drawEmber(ctx, m, t) {
  // a hot coal with a short glowing trail: it must read against any backdrop
  ctx.strokeStyle = 'rgba(255,140,40,0.45)';
  ctx.lineWidth = 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(m.x, m.y);
  ctx.lineTo(m.x - m.vx * 0.35, m.y - m.vy * 0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(m.x, m.y, 0.14, 0, TAU);
  ctx.fillStyle = 'rgba(255,110,20,0.35)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(m.x, m.y, 0.08 + 0.012 * Math.sin(t * 20 + m.x * 7), 0, TAU);
  ctx.fillStyle = '#ffd24a';
  ctx.fill();
  ctx.strokeStyle = '#7a1e00';
  ctx.lineWidth = 0.018;
  ctx.stroke();
}
export function drawBoltWarn(ctx, x, y, t) {
  if (Math.sin(t * 30) < 0) return;
  ctx.beginPath();
  ctx.arc(x, y, 0.3, 0, TAU);
  boltStroke(ctx, 0.016, 1);
}

// ---------- predators (v3): barriers, snakes, eagle ----------
// All take the world-space ctx (meters, y up) and k = px per meter; art helpers draw in px, y down.
const pxSpace = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { /* art never breaks the frame */ } ctx.restore(); };

// Wooden walls on channel floors, turning with their ring (G14). Venom splashes while one melts.
export function drawBarriers(ctx, sim, t, k) {
  for (const b of sim.barriers || []) {
    if (!b.alive) continue;
    const q = sim.barrierPoint(b, 0), a = q.a;
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(a + Math.PI / 2); // art up (-y) points at the vault centre
    ctx.scale(1 / k, -1 / k);
    drawBarrier(ctx, 0, 0, b.w * k * 1.25, b.h * k, t, b.melt, b.fire ? b.burn : 0);
    if (b.melt > 0) drawVenom(ctx, 0, -b.h * k * 0.55, 0.11 * k * (1 - 0.4 * b.melt), t, 1 - 0.5 * b.melt);
    ctx.restore();
  }
}

// Snakes: drawn by render/snake.js (body rig, face, states, entry).
export { drawSnakes, snAnim } from './snake.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Eagle (G48). layer 'back' = its shadow on the vault (drawn under the eggs): faint and soft while it soars,
// sweeping onto the target and turning dark and sharp as it locks on; 'front' = the bird. Pose weights,
// wing beat, the turn-round and blinks are smoothed here per frame; the sim only says what it is doing.
const EA = { t: -1, ph: 0, w: {}, face: 1, turnT: 0, pitch: 0, roll: 0, blink: 2.5, feathers: [], phase: null, res: null, stars: 0, toes: 1, flapT: 0 };
const EASE = (u) => u * u * (3 - 2 * u);

function eagleShadowAt(ctx, sim, E, t, k) {
  const R = sim.outerR;
  let x, y, lock, alpha = 1;
  if (E.phase === 'warn') {
    // sweeps from under the bird over the rings onto the target, then holds it
    const u = EASE(clamp01(E.lk / 0.45)), a0 = Math.atan2(E.y, E.x), a1 = Math.atan2(E.ty, E.tx);
    const da = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)), r0 = R * 0.7, r1 = Math.hypot(E.tx, E.ty);
    const a = a0 + da * u, r = r0 + (r1 - r0) * u;
    x = r * Math.cos(a); y = r * Math.sin(a);
    lock = 0.15 + 0.85 * EASE(clamp01((E.lk - 0.3) / 0.7));
  } else if (E.phase === 'dive' || (E.phase === 'strike' && E.res !== 'grab')) {
    x = E.dtx; y = E.dty; lock = 1;
  } else if (E.phase === 'circle' || E.phase === 'perch' || E.phase === 'up' || E.phase === 'enter') {
    if (E.y < R * 0.3) return; // only from above the vault
    const d = Math.hypot(E.x, E.y) || 1;
    x = (E.x / d) * R * 0.62; y = (E.y / d) * R * 0.62; lock = 0; alpha = E.phase === 'perch' ? 0 : 0.7;
  } else return;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  pxSpace(ctx, x, y, k, () => drawEagleShadow(ctx, 0, 0, EAGLE_LEN * 1.45 * k * (1.15 - 0.15 * lock), -Math.PI / 2 + 0.15 * Math.sin(t * 0.9) * (1 - lock), lock, t));
  ctx.restore();
}

function eagleFeathers(ctx, dt, k) {
  const F = EA.feathers;
  for (let i = F.length - 1; i >= 0; i--) {
    const f = F[i];
    f.life -= dt;
    if (f.life <= 0) { F.splice(i, 1); continue; }
    // a loose feather flutters down: drag, a sideways sway, a slow tumble
    f.vx *= Math.exp(-dt * 2.5); f.vy = Math.max(-0.7, (f.vy - 6 * dt) * Math.exp(-dt * 2.5));
    f.x += (f.vx + Math.sin(f.age * 5 + f.s) * 0.5) * dt; f.y += f.vy * dt; f.age += dt; f.a += f.va * dt;
    pxSpace(ctx, f.x, f.y, k, () => {
      ctx.globalAlpha = Math.min(1, f.life / 0.5);
      ctx.rotate(f.a + Math.sin(f.age * 5 + f.s) * 0.5);
      const L = 0.2 * k * f.sz, W = L * 0.32;
      ctx.beginPath();
      ctx.moveTo(-L / 2, 0);
      ctx.quadraticCurveTo(-L * 0.1, -W, L / 2, -W * 0.15);
      ctx.quadraticCurveTo(L * 0.1, W, -L / 2, 0);
      ctx.fillStyle = f.c; ctx.fill();
      ctx.lineWidth = Math.max(0.8, L * 0.06); ctx.strokeStyle = '#3b2211'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-L * 0.62, 0); ctx.lineTo(L * 0.4, -W * 0.1); ctx.stroke();
    });
  }
}

export function drawEagleAt(ctx, sim, t, k, layer = 'front') {
  const E = sim.eagle;
  if (!E || E.phase === 'away') return;
  if (layer === 'back') { eagleShadowAt(ctx, sim, E, t, k); return; }
  const dt = clamp(t - EA.t, 0, 0.1);
  EA.t = t;
  const calm = isSpriteCalm(), R = sim.outerR;
  // what it is doing -> target pose weights, wing-beat rate
  let W, rate = 8.5;
  const ph = E.phase;
  if (ph !== EA.phase) {
    if ((ph === 'strike' && (E.res === 'slam' || E.res === 'bounce')) || (ph === 'dazed' && EA.phase !== 'strike')) {
      for (let i = 0; i < 6; i++) EA.feathers.push({ x: E.x, y: E.y, vx: (Math.sin(i * 2.4 + t) * 2.2), vy: 1 + (i % 3) * 0.7, a: i, va: (i % 2 ? 1 : -1) * (2 + i), life: 1.6 + (i % 3) * 0.4, age: 0, s: i * 1.7, sz: 0.8 + (i % 3) * 0.25, c: i % 3 ? '#8a5a2b' : '#fbf7ee' });
    }
    EA.phase = ph;
  }
  if (ph === 'warn') { W = { hover: 1 }; rate = 13; }
  else if (ph === 'dive') {
    // gathers itself (wings half up), tucks into the stoop, throws the talons forward at the very end
    const u = clamp01(1 - E.t / (E.dur || 1)), s = clamp01((u - 0.8) / 0.2), h = clamp01(1 - u / 0.25);
    W = { hover: h, dive: (1 - s) * (1 - h), strike: s }; rate = 6;
  } else if (ph === 'strike') { W = { strike: 1 }; rate = 6; }
  else if (ph === 'carry') { W = { carry: 1 }; rate = 10.5; }
  else if (ph === 'dazed') { W = { dazed: 1 }; rate = 0; }
  else if (ph === 'perch' || ph === 'gloat') {
    const d = Math.hypot(E.vx, E.vy);
    W = d > 1.2 ? { flap: 1 } : { perch: 1 }; rate = 11;
  } else {
    // soaring: glides, with a few strong beats when it climbs, speeds up or every few seconds
    const climb = E.vy > 0.5 || ph === 'enter' || ph === 'flee' || ph === 'up';
    if (climb) EA.flapT = 0.8;
    else if (Math.sin(t * 0.7) > 0.93) EA.flapT = Math.max(EA.flapT, 0.4);
    EA.flapT -= dt;
    const f = EA.flapT > 0 ? 1 : 0;
    W = { glide: 1 - f, flap: f }; rate = ph === 'flee' ? 13 : 9;
  }
  // frozen: a held pose (no wing beat, no blend, no blink); stunned: the sim's dazed phase, by lightning or a shock it zaps first
  const st = statusClock(sim, 'e', ph === 'dazed' ? (E.dk === 'frost' ? { k: 'ice', left: E.t } : { k: 'stun', zap: E.dk === 'bolt' || E.dk === 'shock' || E.dk === 'zap', left: E.t }) : null, t);
  const frozen = st && st.k === 'ice';
  const kw = frozen ? 0 : 1 - Math.exp(-dt * 8);
  for (const key of ['glide', 'flap', 'hover', 'dive', 'strike', 'carry', 'dazed', 'perch']) EA.w[key] = (EA.w[key] || 0) + ((W[key] || 0) - (EA.w[key] || 0)) * kw;
  if (!frozen) EA.ph += dt * rate * (calm ? 0.6 : 1);
  // facing, with a quick turn-round (squash through the middle) instead of a snap
  let want = E.face;
  if ((ph === 'strike' || ph === 'carry' && E.ct < 0.3) && Math.abs(E.mx - E.x) > 0.15) want = E.mx > E.x ? 1 : -1;
  if (want !== EA.face && EA.turnT <= 0) EA.turnT = 0.3;
  let turn = 0;
  if (EA.turnT > 0) {
    EA.turnT -= dt;
    const u = 1 - EA.turnT / 0.3;
    turn = 1 - Math.abs(1 - 2 * u);
    if (u >= 0.5) EA.face = want;
    if (EA.turnT <= 0) EA.face = want;
  }
  // body pitch follows the flight path (fully in a dive); in a strike it swings the talons at the target
  const sp = Math.hypot(E.vx, E.vy);
  let pitch = sp > 0.8 ? clamp(-Math.atan2(E.vy, Math.abs(E.vx)) * 0.65, -0.6, 0.75) : 0;
  if (ph === 'dive') pitch = clamp(-Math.atan2(E.vy, Math.abs(E.vx) + 0.01), -1.2, 1.25) * (1 - EA.w.strike);
  let grab = null, toes = null;
  const rel = (x, y) => ({ x: (x - E.x) * k, y: -(y - E.y) * k });
  if (ph === 'strike' || (ph === 'dive' && EA.w.strike > 0.3)) {
    grab = rel(E.mx, E.my);
    const ta = Math.atan2(grab.y, grab.x * EA.face); // talons point at the opening: the body pitches to bring them round
    pitch = clamp(ta - Math.PI / 4, -1.3, 1.0) * clamp01(EA.w.strike * 1.2);
    toes = ph === 'strike' && E.res === 'grab' ? clamp01(1 - (1 - E.t / 0.28) * 1.6) * 0.9 + 0.1 : 1;
  } else if (ph === 'carry') {
    if (E.carry === 'egg') {
      const egg = sim.eggs.find((e) => e.id === E.cid && e.alive);
      if (egg) { const p = egg.body.getPosition(); grab = rel(p.x, p.y + 0.22); }
    } else if (E.carry === 'snake') {
      const S = (sim.snakes || []).find((s) => s.id === E.cid - 1);
      if (S && S.carryX != null) grab = rel(S.carryX, S.carryY);
    } else if (E.carry === 'orb') grab = rel(E.x + E.face * 0.12, E.y - 0.3 * EAGLE_LEN);
    toes = 0.1;
  } else if ((ph === 'perch' || ph === 'gloat') && EA.w.perch > 0.5) {
    grab = rel(E.x + EA.face * 0.05, R + 0.02);
    toes = 0.25;
  }
  if (!frozen) {
    EA.pitch += (pitch - EA.pitch) * (1 - Math.exp(-dt * (ph === 'dive' || ph === 'strike' ? 14 : 5)));
    EA.roll += (clamp(E.bank, -1, 1) - EA.roll) * (1 - Math.exp(-dt * 4));
  }
  // turning round, it rolls through a bank (wings swing over) rather than flattening to a sliver
  const roll = clamp(EA.roll + turn * (EA.roll >= 0 ? 1 : -1), -1, 1);
  EA.stars += ((ph === 'dazed' ? 1 : 0) - EA.stars) * (1 - Math.exp(-dt * 6));
  // blink every few seconds, never while locked on
  EA.blink -= dt;
  if (EA.blink < -0.13) EA.blink = 2.2 + ((t * 7.3) % 1.8);
  const eye = frozen ? 0.5 : EA.blink < 0 && ph !== 'warn' && ph !== 'dive' ? 0.08 : 1;
  const gloat = ph === 'gloat' && E.scr ? 0.55 + 0.45 * Math.sin(t * 9) : 0;
  eagleFeathers(ctx, dt, k);
  if (ph === 'carry' && E.carry === 'orb') pxSpace(ctx, E.x + E.face * 0.12, E.y - 0.3 * EAGLE_LEN - 0.12, k, () => drawOrb(ctx, E.ctype, 0, 0, 0.2 * k, t, true));
  const sz = EAGLE_LEN * k, tt = frozen ? st.hold : t, box = { x0: -1.3 * sz, y0: -1.2 * sz, x1: 1.3 * sz, y1: 1.2 * sz };
  pxSpace(ctx, E.x, E.y, k, () => {
    statusDraw(ctx, box, (c) => drawEagle(c, 0, 0, sz, tt, { w: EA.w, phase: EA.ph, face: EA.face, turn, pitch: EA.pitch, roll, grab, toes, eye, stars: EA.stars, beak: gloat || null }), st, { off: Math.max(1, sz * 0.015), crys: Math.max(1, sz / 80) });
  });
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---------- v3 physics: drawing ----------
const KIND_S = { ostrich: 1.3, quail: 0.75, duck: 1 };
const SHRINK_S = P2.shrink.s;

// Run draw() in the art helpers' local y-down pixel space, at ring angle `ang` (radians, world) and radius
// rad: local +x runs along the ring counter-clockwise, local +y points out of the ring.
function onRing(ctx, k, rad, ang, draw) {
  ctx.save();
  ctx.translate(rad * Math.cos(ang), rad * Math.sin(ang));
  ctx.rotate(ang + Math.PI / 2);
  ctx.scale(1 / k, -1 / k);
  draw();
  ctx.restore();
}

// Ring extras: thorn curtains, grates, molten holes, one-way chevrons. ctx in world space (not rotated).
export function drawV3Ring(ctx, ring, k, t, theme) {
  const A = ring.body.getAngle(), r = ring.r;
  for (const g of ring.gaps) {
    if (g.grate) onRing(ctx, k, r, A + g.a, () => drawGrate(ctx, 0, 0, g.len * k, RING_TH * k, t));
    if (g.narrow) onRing(ctx, k, r, A + g.a, () => drawNarrowBar(ctx, g.len * k, RING_TH * k));
    const C = g.curtain;
    if (C && C.vine) { // v3.3 thorn vine: creeping across, or sealed (fire burns it back)
      onRing(ctx, k, r, A + g.a, () => drawThornVine(ctx, g.len * k, RING_TH * k, C.u, t, C.alive, C.alive ? C.burn : 0, thornLook(theme, ring.mat)));
      continue;
    }
    if (C && (C.alive || C.burn < 1)) {
      onRing(ctx, k, r - RING_TH / 2 - 0.05, A + g.a, () => drawThornCurtain(ctx, 0, 0, g.len * k, (RING_TH + 0.22) * k, t, C.alive ? C.burn : 1));
      if (C.burning && C.alive) {
        // flames eat it from the bottom up
        const q = { x: r * Math.cos(A + g.a), y: r * Math.sin(A + g.a) };
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 30);
        const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, g.len * 0.7);
        gr.addColorStop(0, 'rgba(255,220,90,0.9)');
        gr.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(q.x, q.y, g.len * 0.7, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  // molten holes: runs of melted segments
  let run = null;
  const holes = [];
  for (const sg of ring.segs) {
    if (sg.melt > 0) { if (run && Math.abs(run.a1 - sg.a0) < 1e-4) { run.a1 = sg.a1; run.m = Math.max(run.m, sg.melt); run.v = run.v || sg.vh; } else holes.push((run = { a0: sg.a0, a1: sg.a1, m: sg.melt, v: sg.vh })); }
    else run = null;
  }
  for (const h of holes) onRing(ctx, k, r, A + (h.a0 + h.a1) / 2, () => drawMeltHole(ctx, 0, 0, (h.a1 - h.a0) * r * k, RING_TH * k, t, Math.min(1, h.m / 5), !!h.v));
  // one-way chevrons on the solid parts, every ~1.3 m
  if (ring.oneway) {
    const n = Math.max(3, Math.round((TAU * r) / 1.3));
    for (let i = 0; i < n; i++) {
      const la = (i / n) * TAU + 0.2;
      if (!liveAtV3(ring, la)) continue;
      onRing(ctx, k, r, A + la, () => drawOneWayMark(ctx, 0, 0, RING_TH * k * 1.25, ring.oneway, t));
    }
  }
}
// ostrich levels: a gap too narrow for the big egg gets an iron bar across its middle (small eggs slip past it)
function drawNarrowBar(ctx, len, th) {
  const h = Math.max(3, th * 0.32);
  ctx.fillStyle = '#3b3f47';
  ctx.strokeStyle = '#15171b';
  ctx.lineWidth = Math.max(1, th * 0.08);
  ctx.beginPath();
  ctx.rect(-len / 2 - 2, -h / 2, len + 4, h);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c9ced6';
  for (const x of [-len * 0.3, 0, len * 0.3]) { ctx.beginPath(); ctx.arc(x, 0, h * 0.28, 0, TAU); ctx.fill(); }
}
function liveAtV3(ring, a) {
  a = ((a % TAU) + TAU) % TAU;
  for (const s of ring.segs) if (s.alive && !(s.melt > 0) && ((a >= s.a0 && a < s.a1) || (a + TAU >= s.a0 && a + TAU < s.a1))) return true;
  return false;
}

// Lava rocks: a target mark on the ring while one flies in (fair warning), the rock growing as it
// comes out of the backdrop, then sitting on the ring glowing.
export function drawLavaRocks(ctx, sim, k, t) {
  for (const R of sim.lavaRocks) {
    const ring = sim.rings[R.ri], q = sim.rockAt(R);
    if (R.ph === 'fly') {
      const f = Math.min(1, R.t / 1.1);
      ctx.save();
      ctx.beginPath();
      ctx.arc(q.x, q.y, 0.42 - 0.15 * f, 0, TAU);
      ctx.fillStyle = `rgba(255,90,20,${0.12 + 0.18 * f})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255,214,90,${0.6 + 0.4 * Math.sin(t * 16)})`;
      ctx.lineWidth = Math.max(3 / k, 0.035);
      ctx.setLineDash([0.08, 0.06]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      // smoke trail back toward where it came from
      ctx.strokeStyle = 'rgba(60,40,35,0.35)';
      ctx.lineWidth = 0.12 * (0.4 + 0.6 * f);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(R.x, R.y);
      ctx.lineTo(R.x + (R.x0 - R.x) * 0.15, R.y + (R.y0 - R.y) * 0.15 + 0.2);
      ctx.stroke();
      ctx.save();
      ctx.translate(R.x, R.y);
      ctx.scale(1 / k, -1 / k);
      drawLavaRock(ctx, 0, 0, 0.2 * k * (0.4 + 0.6 * f), t, 1);
      ctx.restore();
    } else {
      // sitting: the ring under it glows as it melts
      const heat = 1 - Math.min(1, R.t / 1.2) * 0.3;
      ctx.save();
      const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 0.6);
      gr.addColorStop(0, `rgba(255,150,40,${0.55 * heat})`);
      gr.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 0.6, 0, TAU);
      ctx.fill();
      ctx.translate(q.x, q.y);
      ctx.scale(1 / k, -1 / k);
      drawLavaRock(ctx, 0, 0, 0.2 * k * (1 - 0.25 * Math.max(0, R.t - 0.8) / 0.4), t, heat);
      ctx.restore();
    }
    void ring;
  }
}

export function drawIcicles(ctx, sim, k, t) {
  for (const c of sim.icicles) {
    ctx.save();
    ctx.translate(c.x + (c.warn > 0 ? Math.sin(t * 50) * 0.015 : 0), c.y);
    if (c.warn > 0) {
      // shimmer before it drops
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 25);
      ctx.strokeStyle = 'rgba(200,240,255,0.9)';
      ctx.lineWidth = Math.max(2 / k, 0.02);
      ctx.beginPath();
      ctx.arc(0, 0, 0.3, 0, TAU);
      ctx.stroke();
    }
    ctx.scale(1 / k, -1 / k);
    drawIcicle(ctx, 0, 0, 0.42 * k, t);
    ctx.restore();
  }
}

// Portal suction field (G18): faint spiral streaks turning in toward the mouth.
export function drawPortalPull(ctx, pt, t) {
  const R = pt.pull;
  if (!R) return;
  ctx.save();
  ctx.translate(pt.ax, pt.ay);
  const g = ctx.createRadialGradient(0, 0, 0.3, 0, 0, R);
  g.addColorStop(0, 'rgba(110,80,255,0.32)');
  g.addColorStop(1, 'rgba(110,80,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const ph = ((t * 0.7 + i / 6) % 1); // each streak spirals inward and fades in
    ctx.strokeStyle = `rgba(200,185,255,${0.85 * Math.sin(Math.PI * ph)})`;
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    for (let s = 0; s <= 8; s++) {
      const f = s / 8, rr = R * (1 - ph) * (1 - f * 0.35) + 0.3 * ph, an = (i * TAU) / 6 + t * 1.6 + f * 0.9 + ph * 2.2;
      if (s) ctx.lineTo(rr * Math.cos(an), rr * Math.sin(an));
      else ctx.moveTo(rr * Math.cos(an), rr * Math.sin(an));
    }
    ctx.stroke();
  }
  ctx.restore();
}
