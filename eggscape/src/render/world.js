// Draws the playfield in world space: ctx is pre-transformed (meters, y up).
import { EGG_H, EGG_W, RING_TH, TAU, eggPoint, rng } from '../sim/geom.js';
import { drawChick } from './characters.js';
import { drawEggPower } from './powers.js';
import { drawLavaRock, drawMeltHole, drawIcicle, drawEggKind, drawThornCurtain, drawGrate, drawOneWayMark } from './v3art.js';
import { drawSkinPreview } from '../ui/store.js';

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

export function drawRing(ctx, ring, theme, k, t, opts = {}) {
  const st = MAT_STYLE[ring.mat] || MAT_STYLE.wood;
  const col = ringColors(ring, theme);
  const r = ring.r, ri = r - RING_TH / 2, ro = r + RING_TH / 2;
  const px = 1 / k;
  ctx.save();
  ctx.rotate(ring.body.getAngle());
  const arcs = liveArcs(ring);
  // dark halo separates the ring from any backdrop
  ctx.strokeStyle = 'rgba(10,6,4,0.45)';
  ctx.lineWidth = RING_TH + 7 * px;
  for (const [a0, a1] of arcs) {
    ctx.beginPath();
    ctx.arc(0, 0, r, a0, a1);
    ctx.stroke();
  }
  // body + shading
  for (const [a0, a1] of arcs) {
    annulus(ctx, ri, ro, a0, a1);
    ctx.globalAlpha = st.alpha || 1;
    ctx.fillStyle = col.base;
    ctx.fill();
    ctx.globalAlpha = 1;
    // inner shadow band and outer light band
    annulus(ctx, ri, ri + RING_TH * 0.28, a0, a1);
    ctx.fillStyle = col.dark;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    annulus(ctx, ro - RING_TH * 0.22, ro, a0, a1);
    ctx.fillStyle = col.light;
    ctx.globalAlpha = st.shine ? 0.75 : 0.45;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // details along the arcs
  for (const [a0, a1] of arcs) {
    const len = (a1 - a0) * r;
    if (st.seam) {
      ctx.strokeStyle = col.dark;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(px, 0.014);
      const n = Math.max(1, Math.round(len / st.seam));
      ctx.beginPath();
      for (let i = 1; i < n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        ctx.moveTo(ri * Math.cos(a), ri * Math.sin(a));
        ctx.lineTo(ro * Math.cos(a), ro * Math.sin(a));
      }
      ctx.stroke();
      if (st.grain) {
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(0, 0, r + 0.012, a0 + 0.02, a1 - 0.02);
        ctx.stroke();
      }
      if (st.blocks) {
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(0, 0, r, a0, a1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (st.rivets) {
      ctx.fillStyle = col.dark;
      const n = Math.max(1, Math.round(len / 0.32));
      for (let i = 0; i < n; i++) {
        const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
        ctx.beginPath();
        ctx.arc(r * Math.cos(a), r * Math.sin(a), 0.022, 0, TAU);
        ctx.fill();
      }
    }
    if (st.dots) {
      ctx.fillStyle = '#fff4ea';
      const n = Math.max(1, Math.round(len / 0.3));
      for (let i = 0; i < n; i++) {
        const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
        const rr = r + (i % 2 ? 0.025 : -0.02);
        ctx.beginPath();
        ctx.arc(rr * Math.cos(a), rr * Math.sin(a), i % 3 ? 0.028 : 0.04, 0, TAU);
        ctx.fill();
      }
    }
    if (st.leaves) {
      // leaves lie flat along the vine (tangent) and are rounded, so they never read as thorns
      const n = Math.max(1, Math.round(len / 0.6));
      ctx.lineWidth = 0.008;
      for (let i = 0; i < n; i++) {
        const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
        const rr = ro - 0.005;
        ctx.save();
        ctx.translate(rr * Math.cos(a), rr * Math.sin(a));
        ctx.rotate(a + Math.PI / 2 + (i % 2 ? 0.25 : -0.25));
        ctx.fillStyle = col.light;
        ctx.beginPath();
        ctx.ellipse(0, 0, 0.065, 0.04, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = col.dark;
        ctx.beginPath();
        ctx.moveTo(-0.05, 0);
        ctx.lineTo(0.05, 0);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (st.puffs) {
      ctx.fillStyle = col.light;
      const n = Math.max(1, Math.round(len / 0.22));
      for (let i = 0; i < n; i++) {
        const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
        ctx.beginPath();
        ctx.arc((ro - 0.02) * Math.cos(a), (ro - 0.02) * Math.sin(a), 0.07 + (i % 3) * 0.015, 0, TAU);
        ctx.fill();
      }
    }
    if (st.bumps) {
      ctx.fillStyle = col.light;
      const n = Math.max(1, Math.round(len / 0.2));
      for (let i = 0; i < n; i++) {
        const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
        const rr = r + ((i * 7) % 3 - 1) * 0.035;
        ctx.beginPath();
        ctx.arc(rr * Math.cos(a), rr * Math.sin(a), 0.026, 0, TAU);
        ctx.fill();
      }
    }
    if (st.veins) {
      ctx.strokeStyle = '#ff7a2a';
      ctx.lineWidth = 0.018;
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 2 + r);
      const n = Math.max(1, Math.round(len / 0.5));
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = a0 + ((a1 - a0) * (i + 0.3)) / n;
        ctx.moveTo((ri + 0.03) * Math.cos(a), (ri + 0.03) * Math.sin(a));
        ctx.lineTo(r * Math.cos(a + 0.06), r * Math.sin(a + 0.06));
        ctx.lineTo((ro - 0.03) * Math.cos(a + 0.02), (ro - 0.03) * Math.sin(a + 0.02));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // end caps
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = Math.max(1.5 * px, 0.02);
    ctx.lineCap = 'round';
    for (const a of [a0, a1]) {
      ctx.beginPath();
      ctx.moveTo(ri * Math.cos(a), ri * Math.sin(a));
      ctx.lineTo(ro * Math.cos(a), ro * Math.sin(a));
      ctx.stroke();
    }
  }
  // outline
  ctx.strokeStyle = col.dark;
  ctx.lineWidth = Math.max(1.4 * px, 0.016);
  for (const [a0, a1] of arcs) {
    ctx.beginPath();
    ctx.arc(0, 0, ro, a0, a1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, ri, a0, a1);
    ctx.stroke();
  }
  // rim light on the outer edge
  ctx.strokeStyle = 'rgba(255,255,255,0.38)';
  ctx.lineWidth = Math.max(1.2 * px, 0.012);
  for (const [a0, a1] of arcs) {
    ctx.beginPath();
    ctx.arc(0, 0, ro - 1.5 * px, a0 + 0.01, a1 - 0.01);
    ctx.stroke();
  }
  // glass damage
  if (ring.M.hp) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.012;
    for (const s of ring.segs) {
      if (!s.alive || s.hp >= ring.M.hp) continue;
      const a = (s.a0 + s.a1) / 2;
      const dmg = ring.M.hp - s.hp;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      for (let j = 0; j < dmg + 1; j++) {
        const aa = a + (j - dmg / 2) * 0.04;
        ctx.moveTo(ri * Math.cos(aa), ri * Math.sin(aa));
        ctx.lineTo((r + 0.02) * Math.cos(aa + 0.03), (r + 0.02) * Math.sin(aa + 0.03));
        ctx.lineTo(ro * Math.cos(aa - 0.01), ro * Math.sin(aa - 0.01));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  // charring where fire is working on a segment
  for (const s of ring.segs) {
    if (!s.alive || s.burn <= 0) continue;
    annulus(ctx, ri, ro, s.a0, s.a1);
    ctx.fillStyle = '#1b0f08';
    ctx.globalAlpha = Math.min(0.85, s.burn * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // motor teeth (clockwork / sandstone mechanisms)
  if (ring.motor) {
    ctx.fillStyle = col.dark;
    for (const [a0, a1] of arcs) {
      const n = Math.max(1, Math.round(((a1 - a0) * ro) / 0.22));
      for (let i = 0; i < n; i++) {
        const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
        const w = 0.05 / ro;
        ctx.beginPath();
        ctx.moveTo(ro * Math.cos(a - w), ro * Math.sin(a - w));
        ctx.lineTo((ro + 0.07) * Math.cos(a - w * 0.6), (ro + 0.07) * Math.sin(a - w * 0.6));
        ctx.lineTo((ro + 0.07) * Math.cos(a + w * 0.6), (ro + 0.07) * Math.sin(a + w * 0.6));
        ctx.lineTo(ro * Math.cos(a + w), ro * Math.sin(a + w));
        ctx.fill();
      }
    }
  }
  drawPads(ctx, ring, theme, px, t, opts.eggs || [], opts.simT || 0);
  drawHoney(ctx, ring, px, t, opts.stuck);
  drawShutters(ctx, ring, col, px);
  if (ring.gear) drawGearTeeth(ctx, ring, col, ring.gear.i > ring.i ? ro : ri, ring.gear.i > ring.i ? 1 : -1);
  // thorns
  drawThorns(ctx, ring, theme, px);
  ctx.restore();
  if (ring.stun > 0) drawStun(ctx, ring, t, px);

  // grab highlight (screen-constant width, not a glow)
  if (opts.held || opts.hover) {
    ctx.save();
    ctx.rotate(ring.body.getAngle());
    ctx.strokeStyle = opts.held ? '#ffffff' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = (opts.held ? 3 : 2) * px;
    ctx.setLineDash(opts.held ? [] : [8 * px, 6 * px]);
    for (const [a0, a1] of arcs) {
      ctx.beginPath();
      ctx.arc(0, 0, ro + 3 * px, a0, a1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, ri - 3 * px, a0, a1);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }
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

// Gear teeth on the face of a ring that turns its neighbour (F15d).
function drawGearTeeth(ctx, ring, col, edge, dir) {
  const n = Math.round((TAU * edge) / 0.16);
  ctx.fillStyle = col.dark;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, w = 0.04 / edge;
    if (!liveAt(ring, a)) continue;
    ctx.beginPath();
    ctx.moveTo(edge * Math.cos(a - w), edge * Math.sin(a - w));
    ctx.lineTo((edge + dir * 0.06) * Math.cos(a - w * 0.55), (edge + dir * 0.06) * Math.sin(a - w * 0.55));
    ctx.lineTo((edge + dir * 0.06) * Math.cos(a + w * 0.55), (edge + dir * 0.06) * Math.sin(a + w * 0.55));
    ctx.lineTo(edge * Math.cos(a + w), edge * Math.sin(a + w));
    ctx.fill();
  }
}
function liveAt(ring, a) {
  for (const s of ring.segs) if (s.alive && ((a >= s.a0 && a < s.a1) || (a + TAU >= s.a0 && a + TAU < s.a1))) return true;
  return false;
}

// The idler cog between two geared rings, at the top of the channel between them.
export function drawGearCog(ctx, inner, outer, t) {
  const rc = (outer.r - inner.r - RING_TH - 0.12) / 2;
  if (rc < 0.08) return;
  const R = (inner.r + outer.r) / 2, a = Math.PI / 2 + 0.35;
  ctx.save();
  ctx.translate(R * Math.cos(a), R * Math.sin(a));
  ctx.rotate((-inner.body.getAngle() * inner.r) / rc);
  const n = 10;
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? rc * 0.78 : rc;
    const b = (i / (n * 2)) * TAU;
    ctx.lineTo(rr * Math.cos(b - 0.12), rr * Math.sin(b - 0.12));
    ctx.lineTo(rr * Math.cos(b + 0.12), rr * Math.sin(b + 0.12));
  }
  ctx.closePath();
  ctx.fillStyle = '#9aa3ad';
  ctx.fill();
  ctx.strokeStyle = '#2c3138';
  ctx.lineWidth = 0.02;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, rc * 0.25, 0, TAU);
  ctx.fillStyle = '#2c3138';
  ctx.fill();
  ctx.restore();
}

// A stunned ring crackles with electric arcs.
function drawStun(ctx, ring, t, px) {
  ctx.save();
  ctx.strokeStyle = 'rgba(170,225,255,0.95)';
  ctx.lineWidth = Math.max(2 * px, 0.02);
  const k = Math.floor(t * 20);
  const R = rng(k * 31 + ring.i);
  for (let j = 0; j < 6; j++) {
    const a = R() * TAU;
    ctx.beginPath();
    for (let q = 0; q < 5; q++) {
      const rr = ring.r + (R() - 0.5) * RING_TH * 1.6, b = a + q * 0.05;
      if (q) ctx.lineTo(rr * Math.cos(b), rr * Math.sin(b)); else ctx.moveTo(rr * Math.cos(b), rr * Math.sin(b));
    }
    ctx.stroke();
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

// Sponge cushions on the inner face: soft, dented where eggs rest, jiggle on impact.
const PAD_H = 0.11;
function padArcs(ring) {
  const arcs = [];
  let cur = null;
  for (const s of ring.segs) {
    if (!s.alive || !s.pad) { cur = null; continue; }
    if (cur && Math.abs(cur.a1 - s.a0) < 1e-4) { cur.a1 = s.a1; cur.segs.push(s); }
    else { cur = { a0: s.a0, a1: s.a1, segs: [s] }; arcs.push(cur); }
  }
  return arcs;
}

function drawPads(ctx, ring, theme, px, t, eggs, simT) {
  const arcs = padArcs(ring);
  if (!arcs.length) return;
  const r = ring.r, ri = r - RING_TH / 2;
  const ang = ring.body.getAngle();
  // eggs near this ring's inner face, in ring-local polar coordinates
  const near = [];
  for (const e of eggs) {
    const rho = Math.hypot(e.x, e.y);
    if (Math.abs(rho - (ri - 0.27)) < 0.22) near.push(Math.atan2(e.y, e.x) - ang);
  }
  const base = theme?.palette?.sponge || '#ffd257';
  for (const A of arcs) {
    const n = Math.max(6, Math.ceil(((A.a1 - A.a0) * r) / 0.03));
    const top = [];
    for (let i = 0; i <= n; i++) {
      const th = A.a0 + ((A.a1 - A.a0) * i) / n;
      let h = PAD_H;
      // pillow scallops
      h += 0.028 * Math.abs(Math.sin(((th - A.a0) * r * Math.PI) / 0.24));
      // ends taper
      const ed = Math.min(th - A.a0, A.a1 - th) * r;
      if (ed < 0.1) h *= 0.3 + 0.7 * (ed / 0.1);
      // dents from resting eggs
      for (const phi of near) {
        const d = Math.abs(wrapA(th - phi)) * r;
        if (d < 0.3) h -= 0.085 * (1 - d / 0.3) * (1 - d / 0.3); // the egg sinks into the foam
      }
      // jiggle after a hit
      const seg = A.segs[Math.min(A.segs.length - 1, Math.floor(((th - A.a0) / (A.a1 - A.a0)) * A.segs.length))];
      const dt = simT - seg.hitT;
      if (dt >= 0 && dt < 0.6) h += Math.min(0.045, seg.hitV * 0.009) * Math.exp(-dt * 7) * Math.sin(dt * 45 + th * 12);
      top.push([th, ri - Math.max(0.015, h)]);
    }
    const ro = r + RING_TH / 2 + 0.025;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const th = A.a0 + ((A.a1 - A.a0) * i) / n;
      const ed = Math.min(th - A.a0, A.a1 - th) * r;
      const rr = ro + 0.012 * Math.abs(Math.sin(((th - A.a0) * r * Math.PI) / 0.24)) * Math.min(1, ed / 0.1);
      if (i) ctx.lineTo(rr * Math.cos(th), rr * Math.sin(th)); else ctx.moveTo(rr * Math.cos(th), rr * Math.sin(th));
    }
    for (let i = top.length - 1; i >= 0; i--) {
      const [th, rr] = top[i];
      ctx.lineTo(rr * Math.cos(th), rr * Math.sin(th));
    }
    ctx.closePath();
    ctx.fillStyle = base;
    ctx.fill();
    // soft shading toward the ring
    ctx.save();
    ctx.clip();
    const sh = ctx.createRadialGradient(0, 0, ri - PAD_H - 0.03, 0, 0, ro);
    sh.addColorStop(0, 'rgba(255,255,235,0.35)');
    sh.addColorStop(0.45, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(150,80,0,0.35)');
    ctx.fillStyle = sh;
    ctx.fillRect(-ro, -ro, ro * 2, ro * 2);
    // pores
    ctx.fillStyle = 'rgba(170,105,20,0.45)';
    const pr = rng(Math.round(A.a0 * 1000) + ring.i * 97);
    const pn = Math.ceil(((A.a1 - A.a0) * r) / 0.025);
    for (let i = 0; i < pn; i++) {
      const th = A.a0 + pr() * (A.a1 - A.a0);
      const rr = ro - 0.02 - pr() * (ro - ri + PAD_H - 0.04);
      ctx.beginPath();
      ctx.ellipse(rr * Math.cos(th), rr * Math.sin(th), 0.008 + pr() * 0.01, 0.006 + pr() * 0.008, th, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // top highlight + outline
    ctx.strokeStyle = 'rgba(255,248,210,0.9)';
    ctx.lineWidth = Math.max(1.5 * px, 0.014);
    ctx.beginPath();
    top.forEach(([th, rr], i) => (i ? ctx.lineTo((rr + 0.008) * Math.cos(th), (rr + 0.008) * Math.sin(th)) : ctx.moveTo((rr + 0.008) * Math.cos(th), (rr + 0.008) * Math.sin(th))));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,70,10,0.85)';
    ctx.lineWidth = Math.max(1.2 * px, 0.012);
    ctx.beginPath();
    top.forEach(([th, rr], i) => (i ? ctx.lineTo(rr * Math.cos(th), rr * Math.sin(th)) : ctx.moveTo(rr * Math.cos(th), rr * Math.sin(th))));
    ctx.stroke();
  }
}

function wrapA(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

function drawThorns(ctx, ring, theme, px) {
  const c = theme?.palette?.thorn || '#3a2a2a';
  for (const th of ring.thorns) {
    if (!th.alive) continue;
    const e = 0.25 + 0.75 * th.ext;
    const half = 0.13 / ring.r;
    const tip = th.base + (th.tip - th.base) * e;
    const a = th.a;
    const P = (rad, an) => [rad * Math.cos(an), rad * Math.sin(an)];
    const [x0, y0] = P(th.base, a - half), [x1, y1] = P(th.base, a + half), [x2, y2] = P(tip, a);
    const [mx, my] = P(th.base + (tip - th.base) * 0.45, a);
    if (th.kind === 'blunt') {
      // blunt grey spike: a stubby cone with a rounded tip (cracks, never breaks)
      const [t0x, t0y] = P(tip, a - half * 0.35), [t1x, t1y] = P(tip, a + half * 0.35);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(t0x, t0y);
      ctx.quadraticCurveTo(x2 + (x2 - mx) * 0.25, y2 + (y2 - my) * 0.25, t1x, t1y);
      ctx.lineTo(x1, y1);
      ctx.closePath();
      ctx.fillStyle = '#8d939b';
      ctx.fill();
      ctx.lineWidth = Math.max(2 * px, 0.022);
      ctx.strokeStyle = '#2f3338';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(235,240,245,0.7)';
      ctx.lineWidth = Math.max(px, 0.01);
      ctx.beginPath();
      ctx.moveTo(x0 * 0.6 + t0x * 0.4, y0 * 0.6 + t0y * 0.4);
      ctx.lineTo(x0 * 0.15 + t0x * 0.85, y0 * 0.15 + t0y * 0.85);
      ctx.stroke();
      continue;
    }
    // body with a curved, hooked silhouette
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(mx + (y1 - y0) * 0.12, my - (x1 - x0) * 0.12, x2, y2);
    ctx.quadraticCurveTo(mx - (y1 - y0) * 0.05, my + (x1 - x0) * 0.05, x1, y1);
    ctx.closePath();
    ctx.fillStyle = '#d23a3a';
    ctx.fill();
    ctx.lineWidth = Math.max(2 * px, 0.022);
    ctx.strokeStyle = '#3a0d0d';
    ctx.stroke();
    // inner shade with theme tint
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x2, y2);
    ctx.lineTo((x0 + x1) / 2, (y0 + y1) / 2);
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    // highlight
    ctx.strokeStyle = 'rgba(255,220,200,0.8)';
    ctx.lineWidth = Math.max(px, 0.01);
    ctx.beginPath();
    ctx.moveTo(x0 * 0.7 + x2 * 0.3, y0 * 0.7 + y2 * 0.3);
    ctx.lineTo(x0 * 0.25 + x2 * 0.75, y0 * 0.25 + y2 * 0.75);
    ctx.stroke();
  }
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
    drawChick(ctx, 0, 0, 0.5 * k, t, v.y < -0.3 ? 1 : 0.3);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  // v3: special eggs are bigger/smaller; a badly cracked egg trembles
  const sc = KIND_S[egg.kind] || 1;
  ctx.rotate(a + (egg.cracks >= 2 ? Math.sin(t * 17 + egg.seed) * 0.05 : 0));
  if (sc !== 1) ctx.scale(sc, sc);
  // shell
  eggPath(ctx);
  let g;
  if (egg.stone > 0) {
    g = ctx.createLinearGradient(-0.2, 0.25, 0.2, -0.25);
    g.addColorStop(0, '#dcd8cf');
    g.addColorStop(0.45, '#8d8a84');
    g.addColorStop(1, '#45423e');
  } else if (egg.golden) {
    g = ctx.createLinearGradient(-0.2, 0.25, 0.2, -0.25);
    g.addColorStop(0, '#fff3b8');
    g.addColorStop(0.5, '#ffc93a');
    g.addColorStop(1, '#b57a0c');
  } else {
    g = ctx.createRadialGradient(-0.07, 0.1, 0.02, 0, 0, 0.36);
    g.addColorStop(0, '#fffdf6');
    g.addColorStop(0.55, egg.fire > 0 ? '#ffd6a0' : '#f7ecd6');
    g.addColorStop(1, egg.fire > 0 ? '#e0803a' : '#d9c3a0');
  }
  ctx.fillStyle = g;
  ctx.fill();
  if (egg.kind && !(egg.stone > 0) && !egg.golden) {
    ctx.save();
    ctx.scale(px / sc, -px / sc);
    drawEggKind(ctx, egg.kind, 0, 0, (EGG_W / 2) * sc * k, (EGG_H / 2) * sc * k, 0, t, 0);
    ctx.restore();
    eggPath(ctx);
  } else if (skin !== 'classic' && !(egg.stone > 0) && !egg.golden && !egg.fire) {
    ctx.save();
    ctx.scale(px, -px);
    drawSkinPreview(ctx, skin, 0, 0, EGG_H * k, t);
    ctx.restore();
    eggPath(ctx);
  }
  ctx.strokeStyle = egg.stone > 0 ? '#2b2926' : 'rgba(90,64,40,0.85)';
  ctx.lineWidth = Math.max(1.5 * px, 0.016);
  ctx.stroke();
  if (egg.prize) {
    // gold speckles: the prize egg of a 'save the speckled egg' bonus
    const R = rng(egg.seed);
    ctx.fillStyle = '#d9a21c';
    for (let i = 0; i < 14; i++) {
      const q = eggPoint(R() * TAU), f = 0.2 + 0.7 * R();
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
  if (egg.glow > 0) {
    eggPath(ctx, 1.1);
    ctx.strokeStyle = `rgba(110,255,120,${Math.min(1, egg.glow)})`;
    ctx.lineWidth = 0.035;
    ctx.stroke();
  }
  // v3 cracks (G34): a bold cartoon zig-zag across the top of the shell. 1 = half way across,
  // 2 = all the way plus a crack down the side, a missing chip and a tremble.
  if (egg.cracks > 0) {
    const n = Math.min(egg.cracks, 3), m = egg.seed & 1 ? 1 : -1, y = 0.12;
    const zig = [];
    const x1 = n >= 2 ? 0.2 : 0.05;
    for (let i = 0, N = n >= 2 ? 8 : 5; i <= N; i++) { const x = -0.2 + ((x1 + 0.2) * i) / N; zig.push([m * x, y + (i % 2 ? 0.04 : -0.02) + (i === N ? 0.01 : 0)]); }
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
      ctx.moveTo(m * -0.06, y + 0.035);
      ctx.lineTo(m * 0.0, y + 0.1);
      ctx.lineTo(m * 0.05, y + 0.03);
      ctx.lineTo(m * 0.0, y - 0.005);
      ctx.closePath();
      ctx.fillStyle = '#4a2e15';
      ctx.fill();
    }
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? '#3a2210' : 'rgba(255,250,235,0.95)';
      ctx.lineWidth = pass ? Math.max(2.4 * px, 0.024) : Math.max(4.6 * px, 0.046);
      ctx.beginPath();
      zig.forEach(([x, yy], j) => (j ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)));
      if (n >= 2) side.forEach(([x, yy], j) => (j ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)));
      ctx.stroke();
    }
    ctx.restore();
  }
  // v3: fox curse tints the shell orange; the guardian feather wraps it in a cool shimmer
  if (egg.curse > 0) {
    eggPath(ctx);
    ctx.fillStyle = `rgba(255,120,30,${0.22 + 0.08 * Math.sin(t * 9)})`;
    ctx.fill();
  }
  if (egg.guard > 0) {
    eggPath(ctx, 1.16);
    ctx.strokeStyle = `rgba(140,230,255,${egg.guard < 1.5 ? 0.4 + 0.4 * Math.sin(t * 20) : 0.85})`;
    ctx.lineWidth = Math.max(2.5 * px, 0.03);
    ctx.stroke();
  }
  ctx.restore();

  // power overlay (powers.js, local y-down): flames stay upright, shells turn with the egg
  const pw = egg.fire > 0 ? egg.fireKind : egg.rockskin > 0 && egg.stone > 0 ? 'rockskin' : egg.stone > 0 ? 'stone' : egg.bubbleFix ? 'bubble' : egg.water > 0 ? 'water' : egg.zap ? 'thunder' : egg.golden ? 'golden' : null;
  if (pw) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (egg.fire <= 0) ctx.rotate(a);
    ctx.scale(px, -px);
    drawEggPower(ctx, pw, t, EGG_H * k * sc);
    ctx.restore();
  }
  // v3 global-power overlays (art in powers.js)
  for (const id of [egg.guard > 0 && 'feather', egg.curse > 0 && 'foxcurse']) {
    if (!id) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(px, -px);
    drawEggPower(ctx, id, t, EGG_H * k * sc);
    ctx.restore();
  }
  if (egg.zap) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = 'rgba(190,230,255,0.95)';
    ctx.lineWidth = Math.max(1.5 * px, 0.015);
    const R = rng(Math.floor(t * 18) + egg.seed);
    for (let j = 0; j < 3; j++) {
      const b0 = R() * TAU;
      ctx.beginPath();
      for (let q = 0; q < 4; q++) { const rr = 0.3 + R() * 0.08, bb = b0 + q * 0.2; q ? ctx.lineTo(rr * Math.cos(bb), rr * Math.sin(bb)) : ctx.moveTo(rr * Math.cos(bb), rr * Math.sin(bb)); }
      ctx.stroke();
    }
    ctx.restore();
  }
  // face: stays upright so it reads; eyes follow velocity
  const v = b.getLinearVelocity();
  const sp = Math.hypot(v.x, v.y);
  ctx.save();
  ctx.translate(p.x, p.y);
  if (sc !== 1) ctx.scale(sc, sc);
  const look = sp > 0.3 ? { x: (v.x / sp) * 0.02, y: (v.y / sp) * 0.02 } : { x: 0, y: 0 };
  const scared = sp > 3.2 || egg.fear > 0;
  const blink = Math.sin(t * 1.3 + egg.seed) > 0.985;
  const eyeY = 0.04;
  ctx.fillStyle = '#2a1d14';
  for (const sx of [-0.075, 0.075]) {
    ctx.beginPath();
    if (blink) ctx.ellipse(sx, eyeY, 0.035, 0.008, 0, 0, TAU);
    else ctx.ellipse(sx + look.x, eyeY + look.y, scared ? 0.034 : 0.028, scared ? 0.044 : 0.036, 0, 0, TAU);
    ctx.fill();
    if (!blink) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx + look.x - 0.01, eyeY + look.y + 0.014, 0.01, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2a1d14';
    }
  }
  // mouth
  ctx.strokeStyle = '#2a1d14';
  ctx.lineWidth = 0.014;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (scared) { ctx.ellipse(0, -0.05, 0.022, 0.03, 0, 0, TAU); ctx.fill(); }
  else { ctx.arc(0, -0.02, 0.035, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); }
  // cheeks
  ctx.fillStyle = 'rgba(255,120,120,0.35)';
  ctx.beginPath();
  ctx.arc(-0.12, -0.03, 0.025, 0, TAU);
  ctx.arc(0.12, -0.03, 0.025, 0, TAU);
  ctx.fill();
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
  ctx.save();
  ctx.translate(p.x, p.y);
  // saved eggs nestled inside
  const n = Math.min(4, savedCount);
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate(-0.33 + i * 0.22, 0.32 + (i % 2) * 0.04);
    ctx.rotate((i - 1.5) * 0.25);
    ctx.scale(0.75, 0.75);
    eggPath(ctx);
    ctx.fillStyle = '#f7ecd6';
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,64,40,0.8)';
    ctx.lineWidth = 0.02;
    ctx.stroke();
    ctx.restore();
  }
  // bowl
  ctx.beginPath();
  ctx.moveTo(-w - 0.12, 0.5);
  ctx.quadraticCurveTo(-w - 0.05, -0.05, 0, -0.04);
  ctx.quadraticCurveTo(w + 0.05, -0.05, w + 0.12, 0.5);
  ctx.quadraticCurveTo(0, 0.3, -w - 0.12, 0.5);
  ctx.fillStyle = straw;
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,45,15,0.9)';
  ctx.lineWidth = 0.02;
  ctx.stroke();
  // woven straw strokes
  const r = rng(11);
  ctx.lineWidth = 0.018;
  for (let i = 0; i < 26; i++) {
    const x0 = -w - 0.05 + r() * (2 * w + 0.1);
    const y0 = 0.05 + r() * 0.38;
    ctx.strokeStyle = i % 3 ? 'rgba(255,230,160,0.7)' : 'rgba(110,75,25,0.6)';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + 0.15, y0 + 0.06 * (r() - 0.5), x0 + 0.3 + r() * 0.2, y0 + (r() - 0.5) * 0.1);
    ctx.stroke();
  }
  // rim
  ctx.beginPath();
  ctx.ellipse(0, 0.47, w + 0.1, 0.08, 0, 0, TAU);
  ctx.strokeStyle = straw;
  ctx.lineWidth = 0.09;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(70,45,15,0.6)';
  ctx.lineWidth = 0.015;
  ctx.stroke();
  ctx.restore();
}

export function drawPortal(ctx, x, y, t, out) {
  const c1 = out ? '#ff9a3c' : '#7c5cff';
  const c2 = out ? '#ffd27a' : '#45d3ff';
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.42);
  g.addColorStop(0, '#05030a');
  g.addColorStop(0.55, '#140c2a');
  g.addColorStop(1, 'rgba(20,12,42,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 0.42, 0, TAU);
  ctx.fill();
  // spiral arms
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const base = (out ? -1 : 1) * t * 2.6 + (i * TAU) / 4;
    ctx.strokeStyle = i % 2 ? c1 : c2;
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    for (let s = 0; s <= 14; s++) {
      const f = s / 14;
      const rr = 0.36 * (1 - f) + 0.04;
      const an = base + f * 3.2;
      const px = rr * Math.cos(an), py = rr * Math.sin(an);
      if (s) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = c1;
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.arc(0, 0, 0.36, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

export function drawBomb(ctx, bomb, t) {
  const b = bomb.body, p = b.getPosition();
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(b.getAngle());
  const g = ctx.createRadialGradient(-0.06, 0.07, 0.01, 0, 0, 0.21);
  g.addColorStop(0, '#6b7280');
  g.addColorStop(1, '#111318');
  ctx.beginPath();
  ctx.arc(0, 0, 0.2, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
  if (bomb.lit && Math.sin(t * (12 + (2.5 - bomb.fuse) * 10)) > 0) {
    ctx.fillStyle = 'rgba(255,60,40,0.55)';
    ctx.fill();
  }
  ctx.fillStyle = '#3a3f48';
  ctx.fillRect(-0.06, 0.16, 0.12, 0.07);
  ctx.strokeStyle = '#c9a26a';
  ctx.lineWidth = 0.025;
  const fl = bomb.lit ? 0.04 + 0.12 * Math.max(0, bomb.fuse / 2.5) : 0.16;
  ctx.beginPath();
  ctx.moveTo(0, 0.23);
  ctx.quadraticCurveTo(0.05, 0.23 + fl * 0.6, 0.08, 0.23 + fl);
  ctx.stroke();
  ctx.restore();
  return { x: p.x + 0.08 * Math.cos(b.getAngle()), y: p.y + 0.23 + fl };
}

export function drawRock(ctx, rock, theme) {
  const b = rock.body, p = b.getPosition();
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(b.getAngle());
  ctx.beginPath();
  rock.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.fillStyle = '#7b7f86';
  ctx.fill();
  ctx.strokeStyle = '#3a3d42';
  ctx.lineWidth = 0.02;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.arc(-rock.s * 0.3, rock.s * 0.3, rock.s * 0.25, 0, TAU);
  ctx.fill();
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

// The fox's fuse: a rope circling the vault that burns down.
export function drawFuse(ctx, R, frac, t, fx) {
  const start = Math.PI / 2;
  const end = start + TAU * frac;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.09;
  ctx.beginPath();
  ctx.arc(0, 0, R, start, start + TAU);
  ctx.stroke();
  if (frac > 0) {
    ctx.strokeStyle = frac < 0.2 ? '#ff5a3c' : '#e9d3a1';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.arc(0, 0, R, start, end);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,80,30,0.7)';
    ctx.lineWidth = 0.015;
    ctx.setLineDash([0.06, 0.06]);
    ctx.beginPath();
    ctx.arc(0, 0, R, start, end);
    ctx.stroke();
    ctx.setLineDash([]);
    const x = R * Math.cos(end), y = R * Math.sin(end);
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
    const x = ring.r * c;
    const over = Math.abs(x - nestX) < nestW / 2 - 0.12;
    const rr = ring.r + 0.3;
    const px = rr * c, py = rr * s;
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
  ctx.strokeStyle = 'rgba(220,240,255,0.9)';
  ctx.lineWidth = 0.03;
  ctx.beginPath();
  ctx.arc(x, y, 0.3, 0, TAU);
  ctx.stroke();
}

// ---------- v3 physics: drawing ----------
const KIND_S = { ostrich: 1.3, quail: 0.75, duck: 1 };

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
export function drawV3Ring(ctx, ring, k, t) {
  const A = ring.body.getAngle(), r = ring.r;
  for (const g of ring.gaps) {
    if (g.grate) onRing(ctx, k, r, A + g.a, () => drawGrate(ctx, 0, 0, g.len * k, RING_TH * k, t));
    const C = g.curtain;
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
    if (sg.melt > 0) { if (run && Math.abs(run.a1 - sg.a0) < 1e-4) { run.a1 = sg.a1; run.m = Math.max(run.m, sg.melt); } else holes.push((run = { a0: sg.a0, a1: sg.a1, m: sg.melt })); }
    else run = null;
  }
  for (const h of holes) onRing(ctx, k, r, A + (h.a0 + h.a1) / 2, () => drawMeltHole(ctx, 0, 0, (h.a1 - h.a0) * r * k, RING_TH * k, t, Math.min(1, h.m / 5)));
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
