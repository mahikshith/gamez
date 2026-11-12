// Ring art (premium pass): every ring is drawn as a slab of real material seen slightly from above.
//   drop shadow -> side wall (the slab's thickness, extruded straight down the screen) -> top face (material texture,
//   cached per ring on an offscreen canvas) -> crisp outline -> bevel light from the top-left on both edges.
// The top face is EXACTLY the physics band (ri..ro); the wall and shadow only ever show below a ring, never on the
// surface an egg rests on, so nothing about where eggs sit changes.
// One painter serves circles (fast arcs) and the shaped vaults (square / hex / spiral polylines via ringPt).
import { RING_TH, TAU, rng } from '../sim/geom.js';
import { ringPt, ringSpd, ringReach, ringNormal } from '../sim/shapes.js';

export const LIGHT = { x: -0.6, y: 0.8 }; // the one light: top-left (world space, y up)
export const WALL = 0.09; // m of slab thickness shown under each ring
const PAD_H = 0.11;

// ---------- colour helpers (memoised) ----------
const RGB = new Map();
export function rgbOf(c) {
  let v = RGB.get(c);
  if (v) return v;
  let m = /^#?([0-9a-f]{6})$/i.exec(c || '');
  if (m) { const n = parseInt(m[1], 16); v = [n >> 16, (n >> 8) & 255, n & 255]; }
  else if ((m = /^#?([0-9a-f]{3})$/i.exec(c || ''))) { const n = parseInt(m[1], 16); v = [((n >> 8) & 15) * 17, ((n >> 4) & 15) * 17, (n & 15) * 17]; }
  else if ((m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(c || ''))) v = [+m[1], +m[2], +m[3]];
  else v = [128, 128, 128];
  RGB.set(c, v);
  return v;
}
const MIX = new Map();
export function mix(a, b, t, alpha) {
  const key = a + '|' + b + '|' + t + '|' + (alpha ?? '');
  let v = MIX.get(key);
  if (v) return v;
  const p = rgbOf(a), q = rgbOf(b), r = Math.round(p[0] + (q[0] - p[0]) * t), g = Math.round(p[1] + (q[1] - p[1]) * t), bl = Math.round(p[2] + (q[2] - p[2]) * t);
  v = alpha == null ? `rgb(${r},${g},${bl})` : `rgba(${r},${g},${bl},${alpha})`;
  if (MIX.size > 4000) MIX.clear();
  MIX.set(key, v);
  return v;
}
export const lighten = (c, t, a) => mix(c, '#ffffff', t, a);
export const darken = (c, t, a) => mix(c, '#000000', t, a);

// ---------- geometry adapters ----------
const STATE = new WeakMap(); // ring -> { memo, cache... }
function stateOf(ring) {
  let s = STATE.get(ring);
  if (!s) STATE.set(ring, (s = { memo: new Map(), canvas: null, key: '', scale: 0 }));
  return s;
}
// Polyline for a shaped ring at radius rad from a0 to a1 (ends nudged inside so a spiral end stays on its own side).
function poly(ring, rad, a0, a1) {
  const S = stateOf(ring), key = rad.toFixed(4) + '|' + a0.toFixed(5) + '|' + a1.toFixed(5);
  let p = S.memo.get(key);
  if (p) return p;
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * ringReach(ring)) / 0.035)), e = Math.sign(a1 - a0) * 1e-6;
  p = new Float32Array((n + 1) * 2);
  for (let i = 0; i <= n; i++) {
    const a = i === 0 ? a0 + e : i === n ? a1 - e : a0 + ((a1 - a0) * i) / n, q = ringPt(ring, a, rad);
    p[i * 2] = q[0]; p[i * 2 + 1] = q[1];
  }
  if (S.memo.size > 600) S.memo.clear();
  S.memo.set(key, p);
  return p;
}
function trace(ctx, p, move) {
  for (let i = 0; i < p.length; i += 2) { if (i === 0 && move) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[i], p[i + 1]); }
}
// Open path along the ring at radius rad.
export function ringLine(ctx, ring, rad, a0, a1) {
  ctx.beginPath();
  if (!ring.prof) { ctx.arc(0, 0, rad, a0, a1); return; }
  trace(ctx, poly(ring, rad, a0, a1), true);
}
// Closed band between two radii.
export function ringBand(ctx, ring, r0, r1, a0, a1) {
  ctx.beginPath();
  if (!ring.prof) { ctx.arc(0, 0, r1, a0, a1); ctx.arc(0, 0, r0, a1, a0, true); ctx.closePath(); return; }
  trace(ctx, poly(ring, r1, a0, a1), true);
  trace(ctx, poly(ring, r0, a1, a0), false);
  ctx.closePath();
}

// Contiguous live arcs (a spiral never joins across its seam).
export function ringArcs(ring) {
  const arcs = [], seam = ring.prof && ring.prof.kind === 'spiral';
  let cur = null;
  for (const s of ring.segs) {
    if (!s.alive || s.melt > 0) { cur = null; continue; }
    const cut = seam && Math.abs(s.a0 / TAU - Math.round(s.a0 / TAU)) < 1e-6;
    if (cur && !cut && Math.abs(cur[1] - s.a0) < 1e-4) cur[1] = s.a1;
    else { cur = [s.a0, s.a1]; arcs.push(cur); }
  }
  if (!seam && arcs.length > 1) {
    const f = arcs[0], l = arcs[arcs.length - 1];
    if (Math.abs(l[1] - (f[0] + TAU)) < 1e-4) { f[0] = l[0] - TAU; arcs.pop(); }
  }
  return arcs;
}
function liveAt(ring, a) {
  for (const s of ring.segs) if (s.alive && ((a >= s.a0 && a < s.a1) || (a + TAU >= s.a0 && a + TAU < s.a1))) return true;
  return false;
}

// ---------- the static top face (what the cache holds) ----------
const BRASS = '#d39a34', BRASS_DK = '#6b4410', BRASS_LT = '#ffe08a';
const CAP = 0.05; // m: the collar on a cut end

function paintFace(ctx, ring, arcs, col, st, px) {
  const r = ring.r, ri = r - RING_TH / 2, ro = r + RING_TH / 2, mat = ring.mat || 'wood';
  const P = (rad, a) => ringPt(ring, a, rad);
  const dot = (rad, a, s) => { const q = P(rad, a); ctx.beginPath(); ctx.arc(q[0], q[1], s, 0, TAU); ctx.fill(); };
  const hair = Math.max(px, 0.009), R = rng(ring.i * 7919 + 13);
  ctx.lineJoin = 'round';
  // gear / motor teeth sit under the face so the band's edge stays clean
  if (ring.motor) {
    for (const [a0, a1] of arcs) {
      const n = Math.max(1, Math.round(((a1 - a0) * ringSpd(ring, (a0 + a1) / 2)) / 0.22));
      for (let i = 0; i < n; i++) {
        const a = a0 + ((a1 - a0) * (i + 0.5)) / n, w = 0.05 / ringSpd(ring, a);
        ctx.beginPath();
        ctx.moveTo(...P(ro - 0.01, a - w)); ctx.lineTo(...P(ro + 0.07, a - w * 0.6)); ctx.lineTo(...P(ro + 0.07, a + w * 0.6)); ctx.lineTo(...P(ro - 0.01, a + w));
        ctx.closePath();
        ctx.fillStyle = darken(col.dark, 0.1); ctx.fill();
        ctx.strokeStyle = darken(col.dark, 0.55); ctx.lineWidth = hair * 1.4; ctx.stroke();
      }
    }
  }
  if (!ring.prof) { if (ring.gearOut) gearTeeth(ctx, ring, ro, 1, hair); if (ring.gearIn) gearTeeth(ctx, ring, ri, -1, hair); }
  for (const [a0, a1] of arcs) {
    // body, with a rounded cross-section: both edges fall away a little, the crown catches light
    ringBand(ctx, ring, ri, ro, a0, a1);
    ctx.globalAlpha = st.alpha || 1;
    ctx.fillStyle = col.base;
    ctx.fill();
    ctx.globalAlpha = 1;
    ringBand(ctx, ring, ri, ri + RING_TH * 0.26, a0, a1);
    ctx.fillStyle = mix(col.dark, col.base, 0.2, 0.34); ctx.fill();
    ringBand(ctx, ring, ro - RING_TH * 0.2, ro, a0, a1);
    ctx.fillStyle = mix(col.dark, col.base, 0.2, 0.2); ctx.fill();
    ringBand(ctx, ring, r - RING_TH * 0.1, r + RING_TH * 0.24, a0, a1);
    ctx.fillStyle = mix(col.light, col.base, 0.15, st.shine ? 0.5 : 0.34); ctx.fill();
  }
  for (const [a0, a1] of arcs) {
    const len = (a1 - a0) * ringSpd(ring, (a0 + a1) / 2), at = (i, n, f = 0.5) => a0 + ((a1 - a0) * (i + f)) / n;
    const seamLines = (n, alpha) => {
      // a cut between pieces: dark line with a lit lip beside it
      const da = 0.012 / ringSpd(ring, (a0 + a1) / 2);
      ctx.lineWidth = Math.max(px * 1.1, 0.014);
      ctx.strokeStyle = darken(col.dark, 0.25, alpha);
      ctx.beginPath();
      for (let i = 1; i < n; i++) { const a = at(i, n, 0); ctx.moveTo(...P(ri, a)); ctx.lineTo(...P(ro, a)); }
      ctx.stroke();
      ctx.strokeStyle = lighten(col.light, 0.3, alpha * 0.5);
      ctx.lineWidth = hair;
      ctx.beginPath();
      for (let i = 1; i < n; i++) { const a = at(i, n, 0) + da; ctx.moveTo(...P(ri + 0.02, a)); ctx.lineTo(...P(ro - 0.02, a)); }
      ctx.stroke();
    };
    const tintPieces = (n, amt) => {
      for (let i = 0; i < n; i++) {
        const v = R();
        ringBand(ctx, ring, ri, ro, at(i, n, 0), at(i, n, 1));
        ctx.fillStyle = v < 0.5 ? darken(col.dark, 0.2, amt * (0.4 + v)) : lighten(col.light, 0.2, amt * (v - 0.2));
        ctx.fill();
      }
    };
    if (mat === 'wood' || !MATS.has(mat)) {
      // planks: each its own tone, grain lines running along it, a nail at each end
      const n = Math.max(1, Math.round(len / 0.55));
      tintPieces(n, 0.2);
      ctx.lineCap = 'round';
      ctx.lineWidth = hair;
      for (let i = 0; i < n; i++) {
        const b0 = at(i, n, 0), b1 = at(i, n, 1), span = b1 - b0;
        for (let j = 0; j < 3; j++) {
          const rad = ri + RING_TH * (0.2 + 0.28 * j + 0.08 * (R() - 0.5)), s0 = b0 + span * (0.06 + 0.25 * R()), s1 = b1 - span * (0.06 + 0.25 * R());
          if (s1 <= s0) continue;
          ctx.strokeStyle = j === 1 ? lighten(col.light, 0.25, 0.4) : darken(col.dark, 0.1, 0.5);
          ringLine(ctx, ring, rad, s0, s1);
          ctx.stroke();
        }
        if (R() < 0.45) { // a knot
          const q = P(r + (R() - 0.5) * 0.05, b0 + span * (0.3 + 0.4 * R()));
          ctx.strokeStyle = darken(col.dark, 0.1, 0.6);
          ctx.beginPath(); ctx.ellipse(q[0], q[1], 0.024, 0.014, ringNormal(ring, b0 + span / 2) + Math.PI / 2, 0, TAU); ctx.stroke();
        }
      }
      seamLines(n, 0.8);
      ctx.fillStyle = darken(col.dark, 0.35);
      for (let i = 0; i < n; i++) for (const f of [0.07, 0.93]) dot(r, at(i, n, f), 0.013);
    } else if (mat === 'stone' || mat === 'bone') {
      const n = Math.max(1, Math.round(len / (st.seam || 0.42)));
      tintPieces(n, mat === 'bone' ? 0.12 : 0.24);
      seamLines(n, mat === 'bone' ? 0.6 : 0.85);
      // pits and chips
      const m = Math.round(len / 0.12);
      for (let i = 0; i < m; i++) {
        const a = a0 + (a1 - a0) * R(), rad = ri + RING_TH * (0.2 + 0.6 * R()), s = 0.007 + 0.009 * R();
        ctx.fillStyle = darken(col.dark, 0.15, 0.45); dot(rad, a, s);
        ctx.fillStyle = lighten(col.light, 0.3, 0.5); const q = P(rad, a); ctx.beginPath(); ctx.arc(q[0] + s * 0.5, q[1] - s * 0.6, s * 0.6, 0, TAU); ctx.fill();
      }
    } else if (mat === 'ice' || mat === 'glass') {
      // frozen-in streaks, a long sheen, hairline cracks
      ctx.lineCap = 'round';
      const n = Math.max(1, Math.round(len / 0.34)), sp = ringSpd(ring, (a0 + a1) / 2);
      for (let i = 0; i < n; i++) {
        const a = at(i, n, 0.2 + 0.6 * R()), w = (0.05 + 0.08 * R()) / sp;
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(px * 1.2, 0.016);
        ringLine(ctx, ring, ro - RING_TH * 0.3, a - w, a + w); ctx.stroke();
        if (R() < 0.6) {
          const b = at(i, n, R());
          ctx.strokeStyle = mix(col.dark, '#ffffff', 0.15, 0.55); ctx.lineWidth = hair;
          ctx.beginPath(); ctx.moveTo(...P(ri + 0.01, b)); ctx.lineTo(...P(r - 0.01, b + 0.035 / sp)); ctx.lineTo(...P(ro - 0.03, b + 0.01 / sp)); ctx.stroke();
        }
      }
    } else if (mat === 'metal' || mat === 'gold') {
      // plates with a brushed sheen and domed rivets
      const n = Math.max(1, Math.round(len / 0.64));
      seamLines(n, 0.6);
      ctx.lineWidth = hair;
      ctx.strokeStyle = lighten(col.light, 0.5, 0.55);
      ringLine(ctx, ring, r + RING_TH * 0.2, a0, a1); ctx.stroke();
      ctx.strokeStyle = darken(col.dark, 0.2, 0.4);
      ringLine(ctx, ring, r - RING_TH * 0.22, a0, a1); ctx.stroke();
      const m = Math.max(1, Math.round(len / 0.32));
      for (let i = 0; i < m; i++) {
        const q = P(r, at(i, m));
        ctx.fillStyle = darken(col.dark, 0.3); ctx.beginPath(); ctx.arc(q[0], q[1], 0.026, 0, TAU); ctx.fill();
        ctx.fillStyle = mix(col.base, col.light, 0.5); ctx.beginPath(); ctx.arc(q[0], q[1], 0.018, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(q[0], q[1], 0.007, 0, TAU); ctx.fill();
      }
    } else if (mat === 'mushroom') {
      const n = Math.max(1, Math.round(len / 0.3));
      for (let i = 0; i < n; i++) {
        const rad = r + (i % 2 ? 0.025 : -0.02), a = at(i, n), s = i % 3 ? 0.028 : 0.04;
        ctx.fillStyle = mix(col.dark, col.base, 0.3, 0.6); dot(rad - 0.008, a, s);
        ctx.fillStyle = '#fff4ea'; dot(rad, a, s);
      }
    } else if (mat === 'coral') {
      const n = Math.max(1, Math.round(len / 0.17));
      for (let i = 0; i < n; i++) {
        const rad = r + (((i * 7) % 3) - 1) * 0.038, a = at(i, n), s = 0.022 + 0.01 * R();
        ctx.fillStyle = mix(col.dark, col.base, 0.2, 0.7); dot(rad - 0.008, a, s);
        ctx.fillStyle = col.light; dot(rad, a, s);
        ctx.fillStyle = mix(col.dark, col.base, 0.3); dot(rad, a, s * 0.32);
      }
    } else if (mat === 'vine') {
      // two woody strands twisting round each other, rounded leaves lying flat along them (never thorn-like)
      const sp = ringSpd(ring, (a0 + a1) / 2), n = Math.max(2, Math.round(len / 0.05));
      for (const ph of [0, Math.PI]) {
        ctx.strokeStyle = ph ? darken(col.dark, 0.1, 0.65) : lighten(col.light, 0.1, 0.55);
        ctx.lineWidth = Math.max(px, 0.014);
        ctx.beginPath();
        for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n, q = P(r + RING_TH * 0.27 * Math.sin((a - a0) * sp / 0.085 + ph), a); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
        ctx.stroke();
      }
      const m = Math.max(1, Math.round(len / 0.6));
      for (let i = 0; i < m; i++) {
        const a = at(i, m), q = P(ro - 0.005, a);
        ctx.save();
        ctx.translate(q[0], q[1]);
        ctx.rotate(ringNormal(ring, a) + Math.PI / 2 + (i % 2 ? 0.25 : -0.25));
        ctx.fillStyle = darken(col.dark, 0.2, 0.5);
        ctx.beginPath(); ctx.ellipse(0.006, -0.012, 0.068, 0.042, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = col.light;
        ctx.beginPath(); ctx.ellipse(0, 0, 0.065, 0.04, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = col.dark; ctx.lineWidth = 0.01;
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-0.05, 0); ctx.lineTo(0.05, 0); ctx.stroke();
        ctx.restore();
      }
    } else if (mat === 'cloud') {
      const n = Math.max(1, Math.round(len / 0.2));
      for (let i = 0; i < n; i++) { ctx.fillStyle = mix(col.dark, col.base, 0.55, 0.8); dot(ro - 0.035, at(i, n), 0.072 + (i % 3) * 0.015); }
      for (let i = 0; i < n; i++) { ctx.fillStyle = col.light; dot(ro - 0.02, at(i, n), 0.066 + (i % 3) * 0.015); }
    } else if (mat === 'obsidian') {
      // glassy facets and veins of fire
      const sp = ringSpd(ring, (a0 + a1) / 2), n = Math.max(1, Math.round(len / 0.26));
      for (let i = 0; i < n; i++) {
        const a = at(i, n, R()), w = 0.07 / sp;
        ctx.beginPath(); ctx.moveTo(...P(ro - 0.01, a - w)); ctx.lineTo(...P(ro - 0.01, a + w)); ctx.lineTo(...P(r - 0.01, a + w * 0.2)); ctx.closePath();
        ctx.fillStyle = lighten(col.light, 0.2, 0.4); ctx.fill();
      }
      const m = Math.max(1, Math.round(len / 0.5));
      ctx.lineCap = 'round';
      for (const [lw, c] of [[0.034, 'rgba(255,90,20,0.45)'], [0.014, '#ffc04a']]) {
        ctx.strokeStyle = c; ctx.lineWidth = lw;
        ctx.beginPath();
        for (let i = 0; i < m; i++) { const a = at(i, m, 0.3), j1 = (((i * 37) % 7) / 7 - 0.5) * 0.3, j2 = (((i * 53) % 5) / 5 - 0.5) * 0.3; ctx.moveTo(...P(ri + 0.02, a)); ctx.lineTo(...P(r - 0.02, a + j1 / sp)); ctx.lineTo(...P(r + 0.03, a + (j1 + j2 * 0.4) / sp)); ctx.lineTo(...P(ro - 0.02, a + (j1 + j2) / sp)); } // jagged cracks, never chevrons
        ctx.stroke();
      }
    }
    // cut ends: a dark collar with a lit lip, so every gap edge reads as a deliberate, solid end
    const cc = darken(col.dark, 0.3), cl = lighten(col.light, 0.25, 0.9);
    for (const [a, e] of [[a0, 1], [a1, -1]]) {
      const w = (CAP / ringSpd(ring, a + e * 0.01)) * e, b0 = Math.min(a, a + w), b1 = Math.max(a, a + w);
      if (b1 - b0 > (a1 - a0) * 0.45) continue;
      ringBand(ctx, ring, ri - 0.012, ro + 0.012, b0, b1);
      ctx.fillStyle = cc; ctx.fill();
      ringBand(ctx, ring, r - RING_TH * 0.05, ro - 0.012, b0 + (b1 - b0) * 0.22, b1 - (b1 - b0) * 0.22);
      ctx.fillStyle = cl; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
    }
  }
}
const MATS = new Set(['wood', 'stone', 'ice', 'mushroom', 'glass', 'metal', 'coral', 'vine', 'cloud', 'obsidian', 'bone', 'gold']);

// Brass gear teeth on the meshing face of a geared ring: cut teeth with a lit flank, on a brass rim.
function gearTeeth(ctx, ring, edge, dir, hair) {
  const n = Math.round((TAU * edge) / 0.16), h = 0.085;
  for (const s of ring.segs) {
    if (!s.alive) continue;
    ctx.beginPath();
    ctx.arc(0, 0, dir > 0 ? edge : edge + 0.034, s.a0, s.a1); ctx.arc(0, 0, dir > 0 ? edge - 0.034 : edge, s.a1, s.a0, true); ctx.closePath();
    ctx.fillStyle = BRASS; ctx.fill();
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, w = 0.045 / edge;
    if (!liveAt(ring, a)) continue;
    const e2 = edge + dir * h, e0 = edge - dir * 0.006;
    ctx.beginPath();
    ctx.moveTo(e0 * Math.cos(a - w), e0 * Math.sin(a - w));
    ctx.lineTo(e2 * Math.cos(a - w * 0.55), e2 * Math.sin(a - w * 0.55));
    ctx.lineTo(e2 * Math.cos(a + w * 0.55), e2 * Math.sin(a + w * 0.55));
    ctx.lineTo(e0 * Math.cos(a + w), e0 * Math.sin(a + w));
    ctx.closePath();
    ctx.fillStyle = BRASS; ctx.fill();
    ctx.strokeStyle = BRASS_DK; ctx.lineWidth = hair * 1.5; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(edge * Math.cos(a - w * 0.5), edge * Math.sin(a - w * 0.5));
    ctx.lineTo((edge + dir * h * 0.82) * Math.cos(a - w * 0.3), (edge + dir * h * 0.82) * Math.sin(a - w * 0.3));
    ctx.strokeStyle = BRASS_LT; ctx.lineWidth = hair * 1.2; ctx.stroke();
  }
}

// ---------- cache ----------
export const ringCache = { on: true, builds: 0 };
function faceKey(ring, col) {
  let h = 7;
  for (const s of ring.segs) h = (h * 31 + (s.alive && !(s.melt > 0) ? 1 : 0)) | 0;
  return h + '|' + col.base + '|' + col.dark + '|' + (ring.mat || '') + '|' + (ring.motor ? 1 : 0) + (ring.gearOut ? 1 : 0) + (ring.gearIn ? 1 : 0);
}
function faceCanvas(ring, arcs, col, st, scale) {
  const S = stateOf(ring), key = faceKey(ring, col);
  const half = (ring.prof ? ringReach(ring) : ring.r) + RING_TH / 2 + 0.14;
  if (S.canvas && S.key === key && scale <= S.scale * 1.04 && scale > S.scale * 0.6) return S;
  if (typeof document === 'undefined') return null;
  scale *= 1.15; // headroom: the camera eases in and out all the time, rebuild only on a real zoom
  let sc = scale;
  const MAX = 1600;
  if (2 * half * sc > MAX) sc = MAX / (2 * half);
  const size = Math.ceil(2 * half * sc);
  const cv = S.canvas || document.createElement('canvas');
  cv.width = size; cv.height = size;
  const c = cv.getContext('2d');
  if (!c) return null;
  c.setTransform(sc, 0, 0, sc, size / 2, size / 2);
  paintFace(c, ring, arcs, col, st, 1 / sc);
  S.canvas = cv; S.key = key; S.scale = scale; S.half = size / 2 / sc;
  ringCache.builds++;
  return S;
}

// ---------- the ring body (called with ctx in world space, not rotated) ----------
export function drawRingBody(ctx, ring, col, st, k) {
  const r = ring.r, ri = r - RING_TH / 2, ro = r + RING_TH / 2, px = 1 / k, A = ring.body.getAngle();
  const arcs = ringArcs(ring);
  const glassy = (st.alpha || 1) < 1;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  // soft drop shadow on whatever is behind the vault (two stacked strokes: a cheap penumbra, no blur)
  ctx.save();
  ctx.translate(0.07, -0.17);
  ctx.rotate(A);
  ctx.strokeStyle = 'rgba(6,4,14,0.13)';
  ctx.lineWidth = RING_TH + 0.16;
  for (const [a0, a1] of arcs) { ringLine(ctx, ring, r, a0, a1); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(6,4,14,0.2)';
  ctx.lineWidth = RING_TH + 0.04;
  for (const [a0, a1] of arcs) { ringLine(ctx, ring, r, a0, a1); ctx.stroke(); }
  ctx.restore();
  // the slab's side wall, straight down the screen
  const ol = Math.max(1.3 * px, 0.02), edge = darken(col.dark, 0.5), wall = mix(col.dark, '#120a10', 0.28);
  ctx.save();
  ctx.translate(0, -WALL);
  ctx.rotate(A);
  ctx.strokeStyle = edge;
  ctx.lineWidth = RING_TH + ol * 2;
  ctx.globalAlpha = glassy ? 0.75 : 1;
  for (const [a0, a1] of arcs) { ringLine(ctx, ring, r, a0, a1); ctx.stroke(); }
  ctx.strokeStyle = wall;
  ctx.lineWidth = RING_TH;
  for (const [a0, a1] of arcs) { ringLine(ctx, ring, r, a0, a1); ctx.stroke(); }
  ctx.restore();
  ctx.save();
  ctx.translate(0, -WALL / 2);
  ctx.rotate(A);
  ctx.globalAlpha = glassy ? 0.75 : 1;
  ctx.strokeStyle = wall;
  ctx.lineWidth = RING_TH;
  for (const [a0, a1] of arcs) { ringLine(ctx, ring, r, a0, a1); ctx.stroke(); }
  ctx.restore();

  ctx.save();
  ctx.rotate(A);
  // outline first (the face covers its inner half, leaving a crisp dark edge outside the band)
  ctx.strokeStyle = edge;
  ctx.lineWidth = RING_TH + ol * 2;
  for (const [a0, a1] of arcs) { ringLine(ctx, ring, r, a0, a1); ctx.stroke(); }
  // top face
  let S = null;
  if (ringCache.on) {
    const m = ctx.getTransform ? ctx.getTransform() : null, scale = m ? Math.hypot(m.a, m.b) : k;
    try { S = faceCanvas(ring, arcs, col, st, scale); } catch (e) { S = null; }
  }
  if (S && S.canvas) ctx.drawImage(S.canvas, -S.half, -S.half, S.half * 2, S.half * 2);
  else paintFace(ctx, ring, arcs, col, st, px);
  // bevel light: the outer edge is lit where it faces the light, the inner edge where it faces away from the centre's
  // shadow; a world-space linear gradient along the light direction is exactly the Lambert term on a circle
  const R = (ring.prof ? ringReach(ring) : r) + RING_TH, lx = LIGHT.x * Math.cos(-A) - LIGHT.y * Math.sin(-A), ly = LIGHT.x * Math.sin(-A) + LIGHT.y * Math.cos(-A);
  const hi = st.shine ? 0.95 : 0.8;
  const g1 = ctx.createLinearGradient(lx * R, ly * R, -lx * R, -ly * R);
  g1.addColorStop(0, `rgba(255,255,255,${hi})`); g1.addColorStop(0.42, 'rgba(255,255,255,0.22)'); g1.addColorStop(0.6, 'rgba(0,0,0,0.05)'); g1.addColorStop(1, 'rgba(10,4,16,0.42)');
  const g2 = ctx.createLinearGradient(-lx * R, -ly * R, lx * R, ly * R);
  g2.addColorStop(0, `rgba(255,255,255,${hi * 0.8})`); g2.addColorStop(0.42, 'rgba(255,255,255,0.14)'); g2.addColorStop(0.6, 'rgba(0,0,0,0.08)'); g2.addColorStop(1, 'rgba(10,4,16,0.5)');
  const bw = Math.max(1.2 * px, RING_TH * 0.2);
  const dim = rgbOf(col.base), dark = dim[0] * 0.3 + dim[1] * 0.59 + dim[2] * 0.11 < 95;
  ctx.lineWidth = bw;
  for (const [a0, a1] of arcs) {
    const c0 = CAP / ringSpd(ring, a0 + 0.01), c1 = CAP / ringSpd(ring, a1 - 0.01);
    if (a1 - a0 < (c0 + c1) * 1.2) continue;
    if (dark) { ctx.strokeStyle = lighten(col.light, 0.15, 0.6); ctx.lineWidth = Math.max(px, 0.018); ringLine(ctx, ring, ro - 0.012, a0 + c0, a1 - c1); ctx.stroke(); ctx.lineWidth = bw; } // dark stone on a dark world: a constant rim keeps the silhouette
    ctx.strokeStyle = g1; ringLine(ctx, ring, ro - bw / 2, a0 + c0, a1 - c1); ctx.stroke();
    ctx.strokeStyle = g2; ringLine(ctx, ring, ri + bw / 2, a0 + c0, a1 - c1); ctx.stroke();
  }
  ctx.restore();
  return arcs;
}

// Charring where fire is working on a piece (dynamic, over the face). ctx rotated to the ring.
export function drawRingBurn(ctx, ring) {
  const ri = ring.r - RING_TH / 2, ro = ring.r + RING_TH / 2;
  for (const s of ring.segs) {
    if (!s.alive || s.burn <= 0) continue;
    ringBand(ctx, ring, ri, ro, s.a0, s.a1);
    ctx.fillStyle = '#1b0f08';
    ctx.globalAlpha = Math.min(0.85, s.burn * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ---------- sponge pads: a fat foam cushion wrapped round the ring; eggs sink into it, it jiggles on a hit ----------
// ctx rotated to the ring. eggs: world positions.
export function drawPads(ctx, ring, theme, px, t, eggs, simT) {
  const runs = [];
  let cur = null;
  for (const s of ring.segs) {
    if (!s.alive || !s.pad) { cur = null; continue; }
    if (cur && Math.abs(cur.a1 - s.a0) < 1e-4) { cur.a1 = s.a1; cur.segs.push(s); } else runs.push((cur = { a0: s.a0, a1: s.a1, segs: [s] }));
  }
  if (!runs.length) return;
  const r = ring.r, ri = r - RING_TH / 2, ro = r + RING_TH / 2 + 0.03, A = ring.body.getAngle();
  const cA = Math.cos(-A), sA = Math.sin(-A);
  const near = eggs.map((e) => ({ x: e.x * cA - e.y * sA, y: e.x * sA + e.y * cA }));
  const base = theme?.palette?.sponge || '#ffd257';
  const lit = lighten(base, 0.45), deep = mix(base, '#b0600a', 0.55), line = mix(base, '#4a2600', 0.8);
  const P = (rad, a) => ringPt(ring, a, rad);
  const dx = -Math.sin(A) * 0.06, dy = -Math.cos(A) * 0.06; // world-down in ring space: the cushion's thickness
  for (const Rn of runs) {
    const n = Math.max(6, Math.ceil(((Rn.a1 - Rn.a0) * (ring.prof ? ringReach(ring) : r)) / 0.03));
    const top = new Array(n + 1), out = new Array(n + 1);
    for (let i = 0; i <= n; i++) {
      const th = Rn.a0 + ((Rn.a1 - Rn.a0) * i) / n, sp = ringSpd(ring, th), ed = Math.min(th - Rn.a0, Rn.a1 - th) * sp;
      const bump = Math.abs(Math.sin(((th - Rn.a0) * sp * Math.PI) / 0.24));
      let h = PAD_H + 0.03 * bump;
      if (ed < 0.1) h *= 0.25 + 0.75 * Math.sqrt(ed / 0.1);
      const s0 = P(ri - 0.27, th);
      for (const q of near) { const d = Math.hypot(q.x - s0[0], q.y - s0[1]); if (d < 0.3) h -= 0.085 * (1 - d / 0.3) * (1 - d / 0.3); }
      const seg = Rn.segs[Math.min(Rn.segs.length - 1, Math.floor(((th - Rn.a0) / (Rn.a1 - Rn.a0)) * Rn.segs.length))], dt = simT - seg.hitT;
      if (dt >= 0 && dt < 0.6) h += Math.min(0.045, seg.hitV * 0.009) * Math.exp(-dt * 7) * Math.sin(dt * 45 + th * 12);
      top[i] = P(ri - Math.max(0.015, h), th);
      out[i] = P(ro + 0.014 * bump * Math.min(1, ed / 0.1), th);
    }
    const shape = (ox, oy) => {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) { if (i) ctx.lineTo(out[i][0] + ox, out[i][1] + oy); else ctx.moveTo(out[i][0] + ox, out[i][1] + oy); }
      for (let i = n; i >= 0; i--) ctx.lineTo(top[i][0] + ox, top[i][1] + oy);
      ctx.closePath();
    };
    ctx.lineJoin = 'round';
    // thickness (darker foam below) with its outline
    shape(dx, dy);
    ctx.fillStyle = deep; ctx.fill();
    ctx.strokeStyle = line; ctx.lineWidth = Math.max(2.4 * px, 0.03); ctx.stroke();
    shape(dx / 2, dy / 2);
    ctx.fillStyle = deep; ctx.fill();
    // top face
    shape(0, 0);
    ctx.strokeStyle = line; ctx.lineWidth = Math.max(2.4 * px, 0.03); ctx.stroke();
    ctx.fillStyle = base; ctx.fill();
    ctx.save();
    ctx.clip();
    // soft form: light on the puffy inner face, warm shade where it tucks under the ring's outer side
    ctx.lineCap = 'round';
    ctx.strokeStyle = mix(deep, base, 0.2, 0.55); ctx.lineWidth = 0.1;
    ctx.beginPath(); for (let i = 0; i <= n; i++) { if (i) ctx.lineTo(out[i][0], out[i][1]); else ctx.moveTo(out[i][0], out[i][1]); } ctx.stroke();
    ctx.strokeStyle = lighten(base, 0.5, 0.7); ctx.lineWidth = 0.085;
    ctx.beginPath(); for (let i = 0; i <= n; i++) { if (i) ctx.lineTo(top[i][0], top[i][1]); else ctx.moveTo(top[i][0], top[i][1]); } ctx.stroke();
    // pores: dark hole, light lower lip (pressed into the foam)
    const pr = rng(Math.round(Rn.a0 * 1000) + ring.i * 97), pn = Math.ceil(((Rn.a1 - Rn.a0) * r) / 0.05);
    for (let i = 0; i < pn; i++) {
      const th = Rn.a0 + (0.04 + 0.92 * pr()) * (Rn.a1 - Rn.a0), q = P(ro - 0.04 - pr() * (ro - ri + PAD_H - 0.09), th), s = 0.011 + pr() * 0.013;
      ctx.fillStyle = lighten(base, 0.6, 0.6);
      ctx.beginPath(); ctx.arc(q[0] + dx * 0.1, q[1] + dy * 0.1, s, 0, TAU); ctx.fill();
      ctx.fillStyle = mix(deep, '#5a2c00', 0.35, 0.8);
      ctx.beginPath(); ctx.arc(q[0], q[1], s * 0.85, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // crisp crest highlight along the puffy edge
    ctx.strokeStyle = 'rgba(255,252,225,0.95)';
    ctx.lineWidth = Math.max(1.3 * px, 0.016);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 1; i < n; i++) { const x = top[i][0] * 0.82 + out[i][0] * 0.18, y = top[i][1] * 0.82 + out[i][1] * 0.18; if (i > 1) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
  }
}
