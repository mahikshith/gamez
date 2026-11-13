// Board pieces (premium pass, to match render/ringart.js): honey pads and gap shutters.
// Both are drawn with ctx rotated to the ring; neither changes where anything collides: the honey's body hugs the
// same inner face the pad's sensor sits on, the doors fill exactly the gap band (ri..ro) the door fixtures fill.
import { RING_TH, TAU, rng } from '../sim/geom.js';
import { WALL, mix, lighten, darken } from './ringart.js';

const fr = (v) => v - Math.floor(v);
const sm = (v) => v * v * (3 - 2 * v);

// ---------- honey: a thick glossy pour on the ring's inner face that laps onto the band; drips hang with gravity ----------
// A pad holding an egg blinks before it lets go; a pad that just let go is dull for a moment.
const HONEY = { body: '#f3a312', deep: '#c96a04', under: '#8f4706', line: '#7a3a04', lit: '#ffd76a', spec: '#fff6d2' };
export function drawHoney(ctx, ring, px, t, stuck = []) {
  if (!ring.honey.length) return;
  const ri = ring.r - RING_TH / 2, ro = ring.r + RING_TH / 2, A = ring.body.getAngle();
  const gx = -Math.sin(A), gy = -Math.cos(A); // world-down, in the ring's own frame
  ctx.save();
  ctx.lineJoin = 'round';
  ring.honey.forEach((h, k) => {
    const half = h.len / (2 * ring.r), a0 = h.a - half, a1 = h.a + half;
    const hold = stuck.find((e) => e.hold && e.hold.ri === ring.i && e.hold.pad === k);
    let al = h.dry > 0 && !hold ? 0.5 : 1;
    if (hold && hold.honey < 0.8) al = Math.sin(t * 28) > 0 ? 1 : 0.38;
    ctx.globalAlpha = al;
    const n = Math.max(10, Math.ceil(h.len / 0.028)), inn = new Array(n + 1), out = new Array(n + 1), mid = new Array(n + 1);
    const thick = (th) => {
      const s = (th - h.a) * ring.r, ed = Math.min(th - a0, a1 - th) * ring.r, end = ed < 0.1 ? Math.sqrt(Math.max(0, ed) / 0.1) : 1;
      // the slow ooze: two fat lumps creeping along the pad in opposite directions
      const l1 = 0.5 + 0.5 * Math.sin(s * 15 + t * 0.8 + k * 2.1), l2 = 0.5 + 0.5 * Math.sin(s * 6.3 - t * 0.5 + k);
      return [(0.058 + 0.04 * l1 + 0.022 * l2) * end, RING_TH * (0.3 + 0.28 * (0.5 + 0.5 * Math.sin(s * 9.5 + 1.3 + k * 1.7))) * end];
    };
    for (let i = 0; i <= n; i++) {
      const th = a0 + ((a1 - a0) * i) / n, c = Math.cos(th), s = Math.sin(th), [hi, ho] = thick(th);
      inn[i] = [(ri - hi) * c, (ri - hi) * s]; out[i] = [(ri + ho) * c, (ri + ho) * s]; mid[i] = [(ri - hi * 0.42) * c, (ri - hi * 0.42) * s];
    }
    const shape = (ox, oy) => {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) { if (i) ctx.lineTo(out[i][0] + ox, out[i][1] + oy); else ctx.moveTo(out[i][0] + ox, out[i][1] + oy); }
      for (let i = n; i >= 0; i--) ctx.lineTo(inn[i][0] + ox, inn[i][1] + oy);
      ctx.closePath();
    };
    const line = (pts, i0 = 0, i1 = n) => { ctx.beginPath(); for (let i = i0; i <= i1; i++) { if (i > i0) ctx.lineTo(pts[i][0], pts[i][1]); else ctx.moveTo(pts[i][0], pts[i][1]); } };
    const lw = Math.max(1.1 * px, 0.014);
    // drips first (they hang from under the body): each grows slowly, lets a drop go, and starts again
    const nd = Math.max(2, Math.round(h.len / 0.19)), R = rng(ring.i * 131 + k * 17 + 5);
    ctx.lineCap = 'round';
    for (let j = 0; j < nd; j++) {
      const th = a0 + ((j + 0.3 + 0.4 * R()) / nd) * (a1 - a0), sd = R(), hang = Math.sin(A + th); // > 0: the pad is overhead here
      const ph = fr(t * (0.1 + 0.05 * sd) + sd * 7), g = ph < 0.82 ? sm(ph / 0.82) : 1 - sm((ph - 0.82) / 0.18) * 0.55;
      const [hi] = thick(th), rb = hang > 0 ? ri - hi * 0.6 : ri + 0.02, bx = rb * Math.cos(th), by = rb * Math.sin(th);
      // overhead it hangs into the channel; underfoot it runs across the band and down the slab's front
      const L = hang > 0 ? (0.05 + 0.1 * g) * Math.sqrt(hang) + hi * 0.4 : (0.05 + (RING_TH * 0.75 + WALL * 0.8 * g) * Math.sqrt(-hang));
      const w = 0.03 + 0.008 * sd, tx = bx + gx * L, ty = by + gy * L, bulb = w * (0.62 + 0.3 * g);
      ctx.strokeStyle = HONEY.line; ctx.lineWidth = w + lw * 2;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = HONEY.line; ctx.beginPath(); ctx.arc(tx, ty, bulb + lw, 0, TAU); ctx.fill();
      ctx.strokeStyle = HONEY.body; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = HONEY.body; ctx.beginPath(); ctx.arc(tx, ty, bulb, 0, TAU); ctx.fill();
      ctx.fillStyle = HONEY.deep; ctx.beginPath(); ctx.arc(tx + gx * bulb * 0.25, ty + gy * bulb * 0.25, bulb * 0.62, 0, TAU); ctx.fill();
      ctx.fillStyle = HONEY.spec; ctx.beginPath(); ctx.arc(tx - 0.3 * bulb - gx * bulb * 0.2, ty + 0.25 * bulb - gy * bulb * 0.2, bulb * 0.3, 0, TAU); ctx.fill();
      if (hang > 0.25 && ph > 0.82) { // the drop it let go, falling away and thinning out
        const q = (ph - 0.82) / 0.18, d = 0.03 + 0.34 * q * q;
        ctx.globalAlpha = al * (1 - q);
        ctx.fillStyle = HONEY.line; ctx.beginPath(); ctx.ellipse(tx + gx * d, ty + gy * d, 0.021 + lw, 0.028 + lw, Math.atan2(gy, gx) + Math.PI / 2, 0, TAU); ctx.fill();
        ctx.fillStyle = HONEY.body; ctx.beginPath(); ctx.ellipse(tx + gx * d, ty + gy * d, 0.021, 0.028, Math.atan2(gy, gx) + Math.PI / 2, 0, TAU); ctx.fill();
        ctx.globalAlpha = al;
      }
    }
    // the body: its own thickness below, then the glossy top
    shape(gx * 0.032, gy * 0.032);
    ctx.fillStyle = HONEY.under; ctx.fill();
    ctx.strokeStyle = HONEY.line; ctx.lineWidth = lw; ctx.stroke();
    shape(0, 0);
    ctx.fillStyle = HONEY.body; ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = mix(HONEY.deep, HONEY.under, 0.25, 0.6); ctx.lineWidth = 0.05; // where it lies thin over the ring's edge it goes deep amber
    ctx.beginPath(); ctx.arc(0, 0, ri + 0.012, a0, a1); ctx.stroke();
    ctx.strokeStyle = mix(HONEY.deep, HONEY.body, 0.3, 0.7); ctx.lineWidth = 0.03;
    line(out); ctx.stroke();
    ctx.strokeStyle = lighten(HONEY.lit, 0.1, 0.85); ctx.lineWidth = 0.05; // the fat rounded lip catches the light
    line(inn); ctx.stroke();
    ctx.restore();
    shape(0, 0);
    ctx.strokeStyle = HONEY.line; ctx.lineWidth = lw; ctx.stroke();
    // wet highlight: a soft sheen, then crisp glints that creep with the ooze
    ctx.lineCap = 'round';
    const e = Math.max(2, Math.round(n * 0.1));
    ctx.strokeStyle = 'rgba(255,240,190,0.5)'; ctx.lineWidth = 0.034;
    line(mid, e, n - e); ctx.stroke();
    ctx.strokeStyle = HONEY.spec; ctx.lineWidth = Math.max(1.3 * px, 0.017);
    ctx.setLineDash([0.085, 0.07, 0.012, 0.075]); ctx.lineDashOffset = -t * 0.035 - k * 0.07;
    line(mid, e, n - e); ctx.stroke();
    ctx.setLineDash([]);
  });
  ctx.restore();
}

// ---------- gap shutters: two doors slide out of housings at the gap's edges and meet in the middle ----------
// Wooden worlds get painted barn doors with iron straps; everything else a steel roller door with a hazard lip.
// A lamp on each housing is green while an egg can pass (g.o > 0.5, the sim's own rule) and red while it cannot.
const WOODY = new Set(['wood', 'vine', 'bone', 'mushroom']);
export function drawShutters(ctx, ring, col, px, lookMat) {
  const r = ring.r, ri = r - RING_TH / 2, ro = r + RING_TH / 2, A = ring.body.getAngle();
  const gx = -Math.sin(A), gy = -Math.cos(A);
  const wood = WOODY.has(lookMat || ring.mat || 'wood');
  const C = wood
    ? { face: '#b8432f', lit: '#e77a5c', dark: '#6e2015', line: '#4a140c', trim: '#f4e3c2', iron: '#3a3238', ironLt: '#8d8791', hous: '#c9952f' }
    : { face: '#9aa7b6', lit: '#e3ebf3', dark: '#4c5766', line: '#272e39', trim: '#ffcf33', iron: '#343b46', ironLt: '#aab6c4', hous: '#5d6877' };
  const band = (r0, r1, a0, a1) => { ctx.beginPath(); ctx.arc(0, 0, r1, a0, a1); ctx.arc(0, 0, r0, a1, a0, true); ctx.closePath(); };
  const radial = (a, r0, r1) => { ctx.moveTo(r0 * Math.cos(a), r0 * Math.sin(a)); ctx.lineTo(r1 * Math.cos(a), r1 * Math.sin(a)); };
  const lw = Math.max(1.1 * px, 0.013);
  ctx.save();
  ctx.lineJoin = 'round';
  for (const g of ring.gaps) {
    if (!g.shut) continue;
    const half = g.len / (2 * r), shut = half * (1 - g.o), open = g.o > 0.5;
    // the doors
    if (shut >= 0.004) {
      for (const e of [-1, 1]) {
        const a0 = e < 0 ? g.a - half : g.a + half - shut, a1 = e < 0 ? g.a - half + shut : g.a + half, lead = e < 0 ? a1 : a0;
        // slab thickness under the door, like the ring's
        ctx.save(); ctx.translate(gx * WALL, gy * WALL);
        band(ri, ro, a0, a1); ctx.fillStyle = darken(C.dark, 0.35); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(gx * WALL * 0.5, gy * WALL * 0.5);
        band(ri, ro, a0, a1); ctx.fillStyle = darken(C.dark, 0.2); ctx.fill();
        ctx.restore();
        band(ri, ro, a0, a1);
        ctx.fillStyle = C.face; ctx.fill();
        ctx.save();
        ctx.clip();
        // rounded cross-section
        band(ri, ri + RING_TH * 0.24, a0, a1); ctx.fillStyle = mix(C.dark, C.face, 0.2, 0.5); ctx.fill();
        band(r - RING_TH * 0.08, r + RING_TH * 0.26, a0, a1); ctx.fillStyle = mix(C.lit, C.face, 0.2, 0.5); ctx.fill();
        // planks / slats: fixed to the door, so they slide with it (measured from the leading edge)
        const step = (wood ? 0.085 : 0.05) / r, m = Math.ceil(shut / step);
        ctx.lineCap = 'butt';
        ctx.strokeStyle = mix(C.line, C.dark, 0.3, wood ? 0.75 : 0.6); ctx.lineWidth = lw;
        ctx.beginPath(); for (let i = 1; i <= m; i++) radial(lead + e * i * step, ri, ro); ctx.stroke();
        ctx.strokeStyle = lighten(C.lit, 0.3, wood ? 0.4 : 0.7); ctx.lineWidth = Math.max(px, 0.009);
        ctx.beginPath(); for (let i = 1; i <= m; i++) radial(lead + e * (i * step - 0.011 / r), ri + 0.015, ro - 0.015); ctx.stroke();
        if (wood) { // an iron strap with studs
          ctx.strokeStyle = C.iron; ctx.lineWidth = 0.034; ctx.beginPath(); ctx.arc(0, 0, r - 0.002, a0, a1); ctx.stroke();
          ctx.strokeStyle = C.ironLt; ctx.lineWidth = Math.max(px, 0.009); ctx.beginPath(); ctx.arc(0, 0, r + 0.013, a0, a1); ctx.stroke();
          ctx.fillStyle = '#d9d2c4';
          for (let i = 0; i <= m; i++) { const a = lead + e * (i + 0.5) * step; ctx.beginPath(); ctx.arc(r * Math.cos(a), r * Math.sin(a), 0.011, 0, TAU); ctx.fill(); }
        }
        // the leading edge: cream trim on the barn door, black-and-yellow hazard lip on the steel one
        const lip = 0.05 / r, l0 = e < 0 ? lead - lip : lead, l1 = e < 0 ? lead : lead + lip;
        band(ri, ro, l0, l1); ctx.fillStyle = C.trim; ctx.fill();
        if (!wood) {
          ctx.strokeStyle = '#20242c'; ctx.lineWidth = 0.02; ctx.beginPath();
          for (let i = -1; i < 5; i++) { const rr = ri + i * 0.045; ctx.moveTo(rr * Math.cos(l0), rr * Math.sin(l0)); ctx.lineTo((rr + 0.04) * Math.cos(l1), (rr + 0.04) * Math.sin(l1)); }
          ctx.stroke();
        }
        ctx.strokeStyle = mix(C.line, C.trim, 0.25, 0.8); ctx.lineWidth = lw;
        ctx.beginPath(); radial(e < 0 ? l0 : l1, ri, ro); ctx.stroke();
        // bevel: lit outer rim, shaded inner rim
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.022; ctx.beginPath(); ctx.arc(0, 0, ro - 0.006, a0, a1); ctx.stroke();
        ctx.strokeStyle = 'rgba(20,6,10,0.3)'; ctx.beginPath(); ctx.arc(0, 0, ri + 0.006, a0, a1); ctx.stroke();
        ctx.restore();
        band(ri, ro, a0, a1);
        ctx.strokeStyle = C.line; ctx.lineWidth = lw; ctx.stroke();
      }
    }
    // housings on the ring at both edges: an iron collar the door slides out of, with the lamp on top
    for (const e of [-1, 1]) {
      const b = g.a + e * half, w = 0.062 / r, b0 = e < 0 ? b - w : b - 0.01 / r, b1 = e < 0 ? b + 0.01 / r : b + w;
      ctx.save(); ctx.translate(gx * WALL, gy * WALL);
      band(ri - 0.028, ro + 0.028, b0, b1); ctx.fillStyle = darken(C.hous, 0.6); ctx.fill();
      ctx.restore();
      band(ri - 0.028, ro + 0.028, b0, b1);
      ctx.fillStyle = C.hous; ctx.fill();
      ctx.strokeStyle = darken(C.hous, 0.55); ctx.lineWidth = lw; ctx.stroke();
      band(r + 0.035, ro + 0.018, b0 + 0.01 / r, b1 - 0.01 / r); // lit outer shoulder
      ctx.fillStyle = lighten(C.hous, 0.45, 0.85); ctx.fill();
      band(ri - 0.018, ri + 0.012, b0 + 0.01 / r, b1 - 0.01 / r); // shaded inner one
      ctx.fillStyle = darken(C.hous, 0.3, 0.6); ctx.fill();
      const am = (b0 + b1) / 2, lx = r * Math.cos(am), ly = r * Math.sin(am);
      ctx.fillStyle = darken(C.hous, 0.7); ctx.beginPath(); ctx.arc(lx, ly, 0.036, 0, TAU); ctx.fill();
      ctx.fillStyle = open ? '#43e070' : '#ff4a3a'; ctx.beginPath(); ctx.arc(lx, ly, 0.027, 0, TAU); ctx.fill();
      ctx.fillStyle = open ? '#e2ffe4' : '#ffe0d6'; ctx.beginPath(); ctx.arc(lx + 0.008 * (gx - gy) , ly + 0.008 * (gy + gx) * -1, 0.01, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}
