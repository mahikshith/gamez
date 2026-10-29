// Eggscape — environmental weather / hazard VISUAL layer (Canvas 2D, no assets, no deps).
//
//   const wx = createWeather('thunder', seed);
//   wx.resize(cssW, cssH, dpr);
//   wx.update(dt, { wind, intensity });
//   wx.drawBack(ctx);   // after backdrop, before the world   (screen space, CSS px, y-down)
//   wx.drawFront(ctx);  // after the world, before the HUD
//   wx.trigger('lightning' | 'quake' | 'gust' | 'ember_burst', data);
//   wx.shakeX / wx.shakeY / wx.flash  (read-only for the caller)
//
// Everything is pooled (typed arrays), deterministic from `seed`, uses no shadowBlur / filter,
// and caches sprites + gradients at resize(). The caller must have set ctx.setTransform(dpr,0,0,dpr,0,0).

export const WEATHER_KINDS = ['none', 'thunder', 'quake', 'embers', 'rain', 'snow', 'sandstorm', 'fog', 'ghosts', 'current', 'leaves', 'ash', 'fireflies'];

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const F32 = (n) => new Float32Array(n);

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rgb(h) { h = h.slice(1); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(h, a) { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; }

function mkc(w, h) {
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(1, 1);
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}

// ------------------------------------------------------------------ sprites (built once per weather)
const SPARK_COLS = ['#ff8a2a', '#ffc04a', '#ffe9a0', '#bcd8ff'];
const GRIT_COLS = ['#b39a74', '#cdb68e', '#8e7a5c'];
const LEAF_COLS = ['#e8a33a', '#c9612e', '#9cbc45', '#d8842f'];

function glowSprite(col, size = 64) {
  const c = mkc(size, size), g = c.getContext('2d'), r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.14, rgba(col, 0.95));
  gr.addColorStop(0.42, rgba(col, 0.28));
  gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return c;
}
function blobSprite(col, size = 128, dense = false) {
  const c = mkc(size, size), g = c.getContext('2d'), r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, rgba(col, 0.9));
  gr.addColorStop(0.35, rgba(col, dense ? 0.8 : 0.5));
  gr.addColorStop(0.7, rgba(col, dense ? 0.3 : 0.12));
  gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return c;
}
function dotSprite(col, size = 16) {
  const c = mkc(size, size), g = c.getContext('2d'), r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.55, rgba(col, 0.9)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return c;
}
// a puffy cloud bank (flat-ish bottom), painted with overlapping soft discs
function cloudSprite(col, W = 320, H = 140, seed = 3) {
  const c = mkc(W, H), g = c.getContext('2d'), R = mulberry(seed);
  const discs = 9;
  for (let i = 0; i < discs; i++) {
    const t = i / (discs - 1);
    const cx = W * (0.12 + 0.76 * t) + (R() - 0.5) * 16;
    const hump = Math.sin(t * Math.PI);
    const r = H * (0.26 + 0.2 * hump + R() * 0.1);
    const cy = H * 0.62 - hump * H * 0.16 + (R() - 0.5) * 10;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, rgba(col, 0.9)); gr.addColorStop(0.55, rgba(col, 0.55)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  return c;
}
function leafSprite(col) {
  const W = 22, H = 14, k = 2, c = mkc(W * k, H * k), g = c.getContext('2d');
  g.scale(k, k);
  g.beginPath(); g.moveTo(1, H / 2); g.quadraticCurveTo(W * 0.35, -1.5, W - 1, H / 2); g.quadraticCurveTo(W * 0.35, H + 1.5, 1, H / 2); g.closePath();
  g.fillStyle = col; g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 0.9;
  g.beginPath(); g.moveTo(1, H / 2); g.lineTo(W - 3, H / 2); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.7;
  g.beginPath(); g.moveTo(6, H / 2); g.lineTo(11, 3.5); g.moveTo(6, H / 2); g.lineTo(11, H - 3.5); g.stroke();
  return c;
}
function ghostSprite() {
  const W = 72, H = 88, k = 2, c = mkc(W * k, H * k), g = c.getContext('2d');
  g.scale(k, k);
  // soft aura
  const au = g.createRadialGradient(W / 2, 38, 4, W / 2, 38, 40);
  au.addColorStop(0, 'rgba(210,200,255,0.35)'); au.addColorStop(1, 'rgba(210,200,255,0)');
  g.fillStyle = au; g.fillRect(0, 0, W, H);
  const cx = W / 2, top = 14, r = 22, base = 74;
  g.beginPath();
  g.moveTo(cx - r, top + r);
  g.arc(cx, top + r, r, Math.PI, 0);
  g.lineTo(cx + r, base - 4);
  const bumps = 4, bw = (r * 2) / bumps;
  for (let i = 0; i < bumps; i++) {
    const x1 = cx + r - bw * (i + 0.5), x2 = cx + r - bw * (i + 1);
    g.quadraticCurveTo(x1, base + (i % 2 ? -7 : 9), x2, base - 4);
  }
  g.closePath();
  const gr = g.createLinearGradient(0, top, 0, base + 6);
  gr.addColorStop(0, 'rgba(248,244,255,0.98)'); gr.addColorStop(0.6, 'rgba(206,194,246,0.8)'); gr.addColorStop(1, 'rgba(176,160,236,0.35)');
  g.fillStyle = gr; g.fill();
  // stub arms
  g.fillStyle = 'rgba(232,224,255,0.75)';
  g.beginPath(); g.ellipse(cx - r - 1, top + r + 14, 5.5, 3.4, 0.55, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(cx + r + 1, top + r + 14, 5.5, 3.4, -0.55, 0, TAU); g.fill();
  // cheeks
  g.fillStyle = 'rgba(255,150,200,0.42)';
  g.beginPath(); g.ellipse(cx - 14, top + r + 7, 4.2, 2.6, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(cx + 14, top + r + 7, 4.2, 2.6, 0, 0, TAU); g.fill();
  // eyes: dark sockets, lime glints
  g.fillStyle = '#2a1d52';
  g.beginPath(); g.ellipse(cx - 8, top + r + 1, 3.6, 5.2, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(cx + 8, top + r + 1, 3.6, 5.2, 0, 0, TAU); g.fill();
  g.fillStyle = '#d8ff8a';
  g.beginPath(); g.arc(cx - 7, top + r - 0.8, 1.6, 0, TAU); g.fill();
  g.beginPath(); g.arc(cx + 9, top + r - 0.8, 1.6, 0, TAU); g.fill();
  // little "o" mouth
  g.fillStyle = '#3a2a66';
  g.beginPath(); g.ellipse(cx, top + r + 11, 2.6, 3.2, 0, 0, TAU); g.fill();
  return c;
}
function causticTile(size = 160) {
  const c = mkc(size, size), g = c.getContext('2d'), im = g.createImageData(size, size), d = im.data;
  const R = mulberry(77);
  const waves = [];
  for (let i = 0; i < 6; i++) waves.push([Math.round(1 + R() * 3) * (R() < 0.5 ? -1 : 1), Math.round(1 + R() * 3) * (R() < 0.5 ? -1 : 1), R() * TAU, 0.8 + R() * 0.4]);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      let s = 0, s2 = 0;
      for (let i = 0; i < 6; i++) { const w = waves[i]; const val = Math.sin(TAU * (w[0] * u + w[1] * v) + w[2]) * w[3]; if (i < 3) s += val; else s2 += val; }
      // ridged: bright thin web where either field crosses zero
      const a = 1 - Math.min(1, Math.abs(s) / 1.2), b = 1 - Math.min(1, Math.abs(s2) / 1.2);
      const val = Math.pow(a * b, 1.4) * 1.5 + Math.pow(Math.max(a, b), 8) * 0.35;
      const o = (y * size + x) * 4;
      d[o] = 200; d[o + 1] = 245; d[o + 2] = 255; d[o + 3] = clamp(val, 0, 1) * 255;
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}

// ------------------------------------------------------------------ main factory
export function createWeather(kind, seed = 1, opts = {}) {
  if (!WEATHER_KINDS.includes(kind)) kind = 'none';
  const S = {
    kind, w: 390, h: 844, dpr: 1, f: 1, u: 1, t: 0,
    wind: 0, I: 1, windRaw: 0,
    R: mulberry((seed >>> 0) ^ hashStr(kind)),
    sp: null, G: {}, tint: opts.tint || null,
  };
  S.apiFlash = () => api.flash;
  const api = {
    kind,
    shakeX: 0, shakeY: 0, flash: 0,
    resize, update, drawBack, drawFront, trigger,
  };

  // event pool: ember sparks, grit, dust, gust streaks, leaves, flares (shared by every kind)
  const ME = 200;
  const E = { ty: F32(ME), x: F32(ME), y: F32(ME), vx: F32(ME), vy: F32(ME), life: F32(ME), max: F32(ME), size: F32(ME), rot: F32(ME), vr: F32(ME), col: F32(ME), cur: 0 };
  const bolts = [];
  let shakeAmp = 0, shakeT = 0, haze = 0, flk = 0, K = null;

  function spawnE(ty, x, y, vx, vy, life, size, col, rot = 0, vr = 0) {
    let i = -1;
    for (let k = 0; k < ME; k++) { const j = (E.cur + k) % ME; if (E.life[j] <= 0) { i = j; break; } }
    if (i < 0) i = E.cur;
    E.cur = (i + 1) % ME;
    E.ty[i] = ty; E.x[i] = x; E.y[i] = y; E.vx[i] = vx; E.vy[i] = vy; E.life[i] = E.max[i] = life; E.size[i] = size; E.col[i] = col; E.rot[i] = rot; E.vr[i] = vr;
  }
  const rr = (a, b) => a + (b - a) * S.R();

  function sprites() {
    if (S.sp) return S.sp;
    const sp = { glow: SPARK_COLS.map((c) => glowSprite(c)), dust: blobSprite('#b49a74'), leaf: LEAF_COLS.map(leafSprite) };
    S.sp = sp;
    return sp;
  }

  function resize(w, h, dpr = 1) {
    S.w = Math.max(1, w); S.h = Math.max(1, h); S.dpr = dpr || 1;
    S.f = clamp((S.w * S.h) / (390 * 844), 0.6, 1.7);
    S.u = clamp(Math.min(S.w, S.h) / 390, 0.8, 1.5);
    sprites();
    // scratch ctx for building cached gradients (gradients are context-independent)
    const sc = mkc(2, 2).getContext('2d');
    S.sc = sc;
    S.G = {};
    K = BUILD[kind] ? BUILD[kind](S, { spawnE, rr, bolts, burst: (x, y) => trigger('ember_burst', { sx: x, sy: y }) }) : null;
    if (K) K.init();
  }

  function update(dt, info) {
    dt = clamp(dt || 0, 0, 0.05);
    if (info) {
      if (typeof info.wind === 'number') S.windRaw = clamp(info.wind, -4, 4);
      if (typeof info.intensity === 'number') S.Iraw = clamp(info.intensity, 0, 1);
    }
    S.t += dt;
    S.wind += (S.windRaw - S.wind) * (1 - Math.exp(-3 * dt));
    S.I += ((S.Iraw === undefined ? 1 : S.Iraw) - S.I) * (1 - Math.exp(-2.5 * dt));
    // flash / shake / haze
    if (api.flash > 0) api.flash = Math.max(0, api.flash - dt * 4);
    if (flk > 0) { flk -= dt; if (flk <= 0) api.flash = Math.max(api.flash, 0.7); }
    if (shakeAmp > 0.03) {
      shakeAmp *= Math.exp(-4.2 * dt); shakeT += dt;
      api.shakeX = shakeAmp * (Math.sin(shakeT * 62) * 0.7 + Math.sin(shakeT * 37 + 1.3) * 0.5);
      api.shakeY = shakeAmp * (Math.cos(shakeT * 55 + 0.4) * 0.6 + Math.sin(shakeT * 83) * 0.3);
    } else { shakeAmp = 0; api.shakeX = 0; api.shakeY = 0; }
    if (haze > 0) haze = Math.max(0, haze - dt * 0.55);
    // events
    const { ty, x, y, vx, vy, life, max, vr, rot } = E;
    for (let i = 0; i < ME; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      const t = ty[i];
      if (t === 0) { vy[i] += 760 * dt; }
      else if (t === 3) { vy[i] += 380 * dt; const k = 1 - 1.4 * dt; vx[i] *= k; }
      else if (t === 1) { const k = 1 - 0.8 * dt; vx[i] *= k; vy[i] *= k; }
      else if (t === 4) { vx[i] *= 1 - 0.5 * dt; vy[i] += 40 * dt; rot[i] += vr[i] * dt; }
      x[i] += vx[i] * dt; y[i] += vy[i] * dt;
      if (t === 0 && y[i] > S.h + 10) life[i] = 0;
    }
    // bolts
    for (let i = bolts.length - 1; i >= 0; i--) { bolts[i].age += dt; if (bolts[i].age > 1.5) bolts.splice(i, 1); }
    if (K) K.update(dt);
  }

  function drawBack(ctx) {
    if (!K || !K.back) return;
    ctx.save(); K.back(ctx); ctx.restore();
  }

  function drawFront(ctx) {
    ctx.save();
    if (K && K.front) K.front(ctx);
    drawEvents(ctx);
    drawBolts(ctx);
    if (api.flash > 0.01) {
      const a = 0.58 * Math.pow(api.flash, 1.4);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a; ctx.fillStyle = '#e4ecff'; ctx.fillRect(0, 0, S.w, S.h);
    }
    if (haze > 0.01) {
      ctx.globalAlpha = Math.min(0.5, haze * 0.34);
      ctx.fillStyle = hazeGrad(); ctx.fillRect(0, 0, S.w, S.h * 0.7);
    }
    ctx.restore();
  }

  function hazeGrad() {
    if (!S.G.haze || S.G.hazeH !== S.h) {
      const g = S.sc.createLinearGradient(0, 0, 0, S.h * 0.7);
      g.addColorStop(0, 'rgba(150,126,96,0.95)'); g.addColorStop(0.5, 'rgba(150,126,96,0.35)'); g.addColorStop(1, 'rgba(150,126,96,0)');
      S.G.haze = g; S.G.hazeH = S.h;
    }
    return S.G.haze;
  }

  // ---------------------------------------------------------------- events
  function drawEvents(ctx) {
    const sp = S.sp, { ty, x, y, vx, vy, life, max, size, col, rot } = E;
    let any = false;
    for (let i = 0; i < ME; i++) if (life[i] > 0) { any = true; break; }
    if (!any) return;
    ctx.lineCap = 'round';
    // pass 1: grit (opaque-ish) + dust + streaks + leaves
    for (let i = 0; i < ME; i++) {
      if (life[i] <= 0) continue;
      const t = life[i] / max[i], T = ty[i];
      if (T === 0) {
        ctx.globalAlpha = Math.min(1, t * 3) * 0.9; ctx.fillStyle = GRIT_COLS[col[i] | 0];
        ctx.fillRect(x[i], y[i], size[i], size[i] * 0.78);
      } else if (T === 1) {
        const r = size[i] * (1.1 - t * 0.5) * S.u;
        ctx.globalAlpha = Math.min(1, (1 - t) * 6) * Math.min(1, t * 1.6) * 0.5;
        ctx.drawImage(sp.dust, x[i] - r, y[i] - r * 0.8, r * 2, r * 1.6);
      } else if (T === 2) {
        ctx.globalAlpha = Math.min(1, t * 2.2, (1 - t) * 8) * 0.55;
        ctx.strokeStyle = S.gustCol || '#ffffff'; ctx.lineWidth = size[i];
        ctx.beginPath(); ctx.moveTo(x[i], y[i]); ctx.lineTo(x[i] - vx[i] * 0.085, y[i] - vy[i] * 0.085); ctx.stroke();
      } else if (T === 4) {
        ctx.globalAlpha = Math.min(1, t * 2) * 0.95;
        const s = size[i] * S.u, c = Math.cos(rot[i]), sn = Math.sin(rot[i]), flip = Math.cos(rot[i] * 1.7);
        const d = S.dpr;
        ctx.setTransform(c * d, sn * d, -sn * flip * d, c * flip * d, x[i] * d, y[i] * d);
        ctx.drawImage(sp.leaf[col[i] | 0], -11 * s, -7 * s, 22 * s, 14 * s);
        ctx.setTransform(d, 0, 0, d, 0, 0);
      }
    }
    // pass 2: additive glows
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < ME; i++) {
      if (life[i] <= 0) continue;
      const t = life[i] / max[i], T = ty[i];
      if (T === 3) {
        const r = size[i] * (0.4 + t * 0.9) * S.u;
        ctx.globalAlpha = Math.min(1, t * 1.8) * (0.7 + 0.3 * Math.sin(S.t * 40 + i));
        ctx.drawImage(sp.glow[col[i] | 0], x[i] - r, y[i] - r, r * 2, r * 2);
      } else if (T === 5) {
        const r = size[i] * (1.5 - t * 1.0) * S.u;
        ctx.globalAlpha = t * t * 0.9;
        ctx.drawImage(sp.glow[col[i] | 0], x[i] - r, y[i] - r, r * 2, r * 2);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- lightning
  function genBolt(x0, y0, x1, y1, depth, disp) {
    let pts = [x0, y0, x1, y1];
    for (let d = 0; d < depth; d++) {
      const out = [pts[0], pts[1]];
      for (let i = 0; i < pts.length - 2; i += 2) {
        const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2], by = pts[i + 3];
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
        const o = (S.R() - 0.5) * len * disp;
        out.push((ax + bx) / 2 - (dy / len) * o, (ay + by) / 2 + (dx / len) * o, bx, by);
      }
      pts = out;
    }
    return pts;
  }
  function makeBolt(sx, sy) {
    const { w, h } = S;
    const x0 = clamp(sx + rr(-0.16, 0.16) * w, 10, w - 10);
    const main = genBolt(x0, -12, sx, sy, 5, 0.5);
    const branches = [];
    const nb = 3 + ((S.R() * 3) | 0);
    const np = main.length / 2;
    for (let k = 0; k < nb; k++) {
      const pi = Math.floor(np * rr(0.18, 0.82)), px = main[pi * 2], py = main[pi * 2 + 1];
      const nx = main[Math.min(np - 1, pi + 3) * 2], ny = main[Math.min(np - 1, pi + 3) * 2 + 1];
      const ang = Math.atan2(ny - py, nx - px) + (S.R() < 0.5 ? -1 : 1) * rr(0.35, 0.95);
      const len = rr(0.08, 0.22) * h;
      branches.push(genBolt(px, py, px + Math.cos(ang) * len, py + Math.abs(Math.sin(ang)) * len * 0.9 + 6, 3, 0.55));
    }
    return { main, branches, age: 0, sx, sy };
  }
  function strokePts(ctx, p) {
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
  }
  function drawBolts(ctx) {
    if (!bolts.length) return;
    const sp = S.sp;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let bi = 0; bi < bolts.length; bi++) {
      const b = bolts[bi], a = b.age;
      let k;
      if (a < 0.07) k = 1; else if (a < 0.13) k = 0.28; else if (a < 0.2) k = 0.95; else k = 0.75 * Math.exp(-(a - 0.2) * 6);
      const glowAfter = a > 0.2 ? 0.3 * Math.exp(-(a - 0.2) * 2.1) : 0;
      const e = Math.max(k, glowAfter);
      if (e < 0.01) continue;
      const u = S.u;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#7fa6ff';
      ctx.globalAlpha = 0.10 * e; ctx.lineWidth = 16 * u;
      ctx.beginPath(); strokePts(ctx, b.main); for (const br of b.branches) strokePts(ctx, br); ctx.stroke();
      ctx.strokeStyle = '#aecbff';
      ctx.globalAlpha = 0.24 * e; ctx.lineWidth = 7 * u;
      ctx.beginPath(); strokePts(ctx, b.main); for (const br of b.branches) strokePts(ctx, br); ctx.stroke();
      // strike glow
      if (k > 0.05) {
        const r = 110 * u * (0.5 + k * 0.5);
        ctx.globalAlpha = k * 0.8; ctx.drawImage(sp.glow[3], b.sx - r, b.sy - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#f4f8ff';
      ctx.globalAlpha = Math.min(1, e * 1.25); ctx.lineWidth = 2.4 * u;
      ctx.beginPath(); strokePts(ctx, b.main); ctx.stroke();
      ctx.lineWidth = 1.2 * u; ctx.globalAlpha = Math.min(1, e * 1.1) * 0.9;
      ctx.beginPath(); for (const br of b.branches) strokePts(ctx, br); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function trigger(name, data) {
    data = data || {};
    const { w, h } = S;
    if (name === 'lightning') {
      const sx = typeof data.sx === 'number' ? data.sx : w * 0.5, sy = typeof data.sy === 'number' ? data.sy : h * 0.5;
      if (bolts.length >= 3) bolts.shift();
      bolts.push(makeBolt(sx, sy));
      api.flash = 1; flk = 0.1 + S.R() * 0.04;
      spawnE(5, sx, sy, 0, 0, 0.35, 90, 3);
      for (let i = 0; i < 12; i++) {
        const an = rr(-Math.PI, 0), sp = rr(80, 300);
        spawnE(3, sx, sy, Math.cos(an) * sp, Math.sin(an) * sp, rr(0.35, 0.8), rr(5, 9), 3);
      }
    } else if (name === 'quake') {
      const s = clamp(typeof data.strength === 'number' ? data.strength : 0.6, 0, 1);
      shakeAmp = Math.max(shakeAmp, 3 + 11 * s) * (S.u > 1.2 ? 1.2 : 1); shakeT = 0;
      haze = Math.max(haze, 0.4 + 0.6 * s);
      const ng = Math.round((14 + 34 * s) * Math.min(1.4, S.f));
      for (let i = 0; i < ng; i++) spawnE(0, rr(0, w), -rr(6, 80), rr(-25, 25), rr(40, 220), rr(1.3, 2.4), rr(2, 5.5) * S.u, (S.R() * 3) | 0);
      const nd = 5 + Math.round(8 * s);
      for (let i = 0; i < nd; i++) spawnE(1, rr(0, w), rr(-10, 40), rr(-12, 12), rr(18, 55), rr(1.3, 2.2), rr(36, 80), 0);
    } else if (name === 'gust') {
      const dir = data.dir < 0 ? -1 : 1;
      const n = Math.round(18 * Math.min(1.3, S.f));
      for (let i = 0; i < n; i++) {
        spawnE(2, dir > 0 ? -rr(0, 0.35) * w : w * (1 + rr(0, 0.35)), rr(0.04, 0.96) * h, dir * rr(700, 1300), rr(-30, 50), rr(0.55, 1.0), rr(1, 2.4), 0);
      }
      if (kind === 'leaves') {
        for (let i = 0; i < 9; i++) spawnE(4, dir > 0 ? -rr(0, 0.2) * w : w * (1 + rr(0, 0.2)), rr(0.1, 0.9) * h, dir * rr(260, 520), rr(-90, 30), rr(2.0, 3.2), rr(0.7, 1.2), (S.R() * 4) | 0, S.R() * TAU, rr(-9, 9));
      }
    } else if (name === 'ember_burst') {
      const sx = typeof data.sx === 'number' ? data.sx : w * 0.5, sy = typeof data.sy === 'number' ? data.sy : h * 0.9;
      spawnE(5, sx, sy, 0, 0, 0.4, 70, 0);
      const n = Math.round(24 * Math.min(1.3, S.f));
      for (let i = 0; i < n; i++) {
        const an = rr(-Math.PI * 0.95, -Math.PI * 0.05), sp = rr(110, 400);
        spawnE(3, sx, sy, Math.cos(an) * sp, Math.sin(an) * sp, rr(0.8, 1.7), rr(6, 12), (S.R() * 3) | 0);
      }
    }
  }

  S.Iraw = undefined;
  return api;
}

// ================================================================== per-kind builders
// Each returns { init(), update(dt), back(ctx), front(ctx) }.
const BUILD = {};

function vgrad(S, y0, y1, stops) {
  const g = S.sc.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

// ------------------------------------------------------------------ rain / thunder
function rainKind(S, heavy, X) {
  const col = heavy ? '#b6c9ee' : '#c4d9f2';
  let n = 0, x, y, z, v, L;
  const MS = 26; const sx = F32(MS), sy = F32(MS), sl = F32(MS);
  const addSplash = (px, py) => { for (let i = 0; i < MS; i++) if (sl[i] <= 0) { sx[i] = px; sy[i] = py; sl[i] = 0.34; return; } };
  function respawn(i, init) {
    const R = S.R;
    z[i] = R(); v[i] = 0.85 + R() * 0.3;
    L[i] = (0.80 + 0.17 * z[i]) * S.h + R() * 0.03 * S.h;
    x[i] = -0.3 * S.w + R() * 1.6 * S.w;
    y[i] = init ? R() * L[i] : -R() * 140 - 20;
  }
  function drawRain(ctx, z0, z1) {
    const cnt = Math.round(n * clamp(S.I, 0, 1));
    const aS = 0.55 + 0.45 * S.I;
    ctx.strokeStyle = col; ctx.lineCap = 'round';
    const buckets = [[0, 0.4, 0.9, 0.3], [0.4, 0.75, 1.2, 0.42], [0.75, 1.01, 1.8, 0.55]];
    for (let b = 0; b < 3; b++) {
      const lo = Math.max(z0, buckets[b][0]), hi = Math.min(z1, buckets[b][1]);
      if (lo >= hi) continue;
      ctx.globalAlpha = buckets[b][3] * aS * (heavy ? 1.05 : 1); ctx.lineWidth = buckets[b][2] * (S.u > 1.2 ? 1.2 : 1);
      ctx.beginPath();
      for (let i = 0; i < cnt; i++) {
        const zz = z[i]; if (zz < lo || zz >= hi) continue;
        const spd = (650 + 800 * zz) * v[i], vxx = S.wind * 80 * (0.4 + zz) * (heavy ? 1.2 : 1);
        ctx.moveTo(x[i], y[i]); ctx.lineTo(x[i] - vxx * 0.028, y[i] - spd * 0.028);
      }
      ctx.stroke();
    }
  }
  return {
    init() {
      n = Math.round((heavy ? 180 : 150) * S.f);
      x = F32(n); y = F32(n); z = F32(n); v = F32(n); L = F32(n);
      for (let i = 0; i < n; i++) respawn(i, true);
      sl.fill(0);
      S.G.veil = vgrad(S, 0, S.h * 0.3, [[0, heavy ? 'rgba(8,12,30,0.5)' : 'rgba(30,40,60,0.28)'], [1, 'rgba(8,12,30,0)']]);
      if (heavy) {
        const sp = S.sp;
        S.G.clouds = [cloudSprite('#161b30', 320, 140, 11), cloudSprite('#1c2238', 320, 140, 12)];
        S.G.lit = [cloudSprite('#a6b6e0', 320, 140, 11), cloudSprite('#a6b6e0', 320, 140, 12)];
        X.cl = [];
        for (let i = 0; i < 6; i++) X.cl.push({ x: (i / 6) * (S.w + 200) - 100, y: (S.R() - 0.5) * 0.05 * S.h + 0.035 * S.h + (i % 3) * 0.022 * S.h, s: 0.6 + S.R() * 0.5, v: 5 + S.R() * 8, k: i % 2, ph: S.R() * TAU });
      }
    },
    update(dt) {
      const t = S.t;
      for (let i = 0; i < n; i++) {
        const zz = z[i], spd = (650 + 800 * zz) * v[i];
        x[i] += S.wind * 80 * (0.4 + zz) * (heavy ? 1.2 : 1) * dt; y[i] += spd * dt;
        if (y[i] >= L[i]) { if (zz > 0.4 && S.R() < 0.55) addSplash(x[i], L[i]); respawn(i, false); }
      }
      for (let i = 0; i < MS; i++) if (sl[i] > 0) sl[i] -= dt;
      if (heavy) for (const c of X.cl) { c.x += (c.v + S.wind * 3) * dt; if (c.x > S.w + 160) c.x = -300; else if (c.x < -330) c.x = S.w + 150; }
    },
    back(ctx) {
      ctx.fillStyle = S.G.veil; ctx.globalAlpha = 0.4 + 0.6 * S.I; ctx.fillRect(0, 0, S.w, S.h * 0.3);
      if (heavy) {
        const t = S.t, fl = api0(S);
        for (const c of X.cl) {
          const wdt = S.w * 0.72 * c.s, hgt = wdt * 0.44, cy = c.y * 1 + Math.sin(t * 0.25 + c.ph) * 5 - hgt * 0.5;
          ctx.globalAlpha = 0.5 + 0.2 * S.I;
          ctx.drawImage(S.G.clouds[c.k], c.x, cy, wdt, hgt);
          if (fl > 0.04) { ctx.globalAlpha = Math.min(0.8, fl * 0.85); ctx.drawImage(S.G.lit[c.k], c.x, cy, wdt, hgt); }
        }
      }
      drawRain(ctx, 0, 0.4);
    },
    front(ctx) {
      drawRain(ctx, 0.4, 1.01);
      // splash ticks
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.lineCap = 'round';
      for (let i = 0; i < MS; i++) {
        if (sl[i] <= 0) continue;
        const t = 1 - sl[i] / 0.34, rx = 2 + t * 7, ry = rx * 0.32;
        ctx.globalAlpha = (1 - t) * 0.5;
        ctx.beginPath();
        ctx.ellipse(sx[i], sy[i], rx, ry, 0, 0, TAU);
        ctx.moveTo(sx[i] - rx * 0.5, sy[i] - 1); ctx.lineTo(sx[i] - rx * 0.8, sy[i] - 3 - t * 5);
        ctx.moveTo(sx[i] + rx * 0.5, sy[i] - 1); ctx.lineTo(sx[i] + rx * 0.8, sy[i] - 3 - t * 5);
        ctx.stroke();
      }
    },
  };
}
// the flash value lives on the api object; builders reach it through this tiny indirection
function api0(S) { return S.apiFlash ? S.apiFlash() : 0; }
BUILD.rain = (S, X) => rainKind(S, false, X);
BUILD.thunder = (S, X) => rainKind(S, true, X);

// ------------------------------------------------------------------ snow
BUILD.snow = (S) => {
  let n = 0, x, y, z, ph, s;
  const dotDraw = (ctx, z0, z1, big) => {
    const sp = S.sp, cnt = Math.round(n * clamp(0.25 + 0.75 * S.I, 0, 1));
    for (let i = 0; i < cnt; i++) {
      const zz = z[i]; if (zz < z0 || zz >= z1) continue;
      const r = (0.9 + 2.6 * Math.pow(zz, 1.3) + s[i] * 0.5) * S.u;
      if (zz > 0.86) { const rb = r * 2.4; ctx.globalAlpha = 0.5; ctx.drawImage(S.G.soft, x[i] - rb, y[i] - rb, rb * 2, rb * 2); }
      else { ctx.globalAlpha = 0.35 + 0.55 * zz; ctx.drawImage(S.G.dot, x[i] - r, y[i] - r, r * 2, r * 2); }
    }
  };
  return {
    init() {
      n = Math.round(110 * S.f);
      x = F32(n); y = F32(n); z = F32(n); ph = F32(n); s = F32(n);
      for (let i = 0; i < n; i++) { x[i] = S.R() * S.w; y[i] = S.R() * S.h; z[i] = S.R(); ph[i] = S.R() * TAU; s[i] = S.R(); }
      S.G.dot = dotSprite('#ffffff', 16); S.G.soft = blobSprite('#ffffff', 48);
    },
    update(dt) {
      const t = S.t;
      for (let i = 0; i < n; i++) {
        const zz = z[i];
        y[i] += (18 + 44 * zz) * (0.8 + 0.4 * s[i]) * dt;
        x[i] += (S.wind * (10 + 26 * zz) + Math.sin(t * 0.9 + ph[i]) * (7 + 10 * zz)) * dt;
        if (y[i] > S.h + 12) { y[i] = -12; x[i] = S.R() * S.w; }
        if (x[i] > S.w + 12) x[i] -= S.w + 24; else if (x[i] < -12) x[i] += S.w + 24;
      }
    },
    back(ctx) { dotDraw(ctx, 0, 0.34); },
    front(ctx) { dotDraw(ctx, 0.34, 1.01); },
  };
};

// ------------------------------------------------------------------ embers (volcano)
BUILD.embers = (S, X) => {
  let n = 0, x, y, z, ph, s, ci, nextBurst = 4;
  const MB = 5;
  const respawn = (i, init) => {
    const R = S.R;
    x[i] = R() * S.w; y[i] = init ? R() * S.h : S.h + 8 + R() * 60;
    z[i] = R(); ph[i] = R() * TAU; s[i] = R(); ci[i] = (R() * 3) | 0;
  };
  const drawE = (ctx, z0, z1) => {
    const sp = S.sp, cnt = Math.round(n * clamp(0.3 + 0.7 * S.I, 0, 1)), t = S.t;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < cnt; i++) {
      const zz = z[i]; if (zz < z0 || zz >= z1) continue;
      const fl = 0.55 + 0.45 * Math.sin(t * (5 + s[i] * 7) + ph[i]);
      const top = sstep(0.0, 0.25, y[i] / S.h);
      const r = (3.5 + 8 * zz) * S.u * (0.8 + 0.3 * fl);
      ctx.globalAlpha = (0.25 + 0.6 * zz) * fl * top;
      ctx.drawImage(sp.glow[ci[i]], x[i] - r, y[i] - r, r * 2, r * 2);
    }
  };
  return {
    init() {
      n = Math.round(60 * S.f);
      x = F32(n); y = F32(n); z = F32(n); ph = F32(n); s = F32(n); ci = F32(n);
      for (let i = 0; i < n; i++) respawn(i, true);
      nextBurst = 2 + S.R() * 3;
      S.G.glow = vgrad(S, S.h * 0.58, S.h, [[0, 'rgba(255,90,20,0)'], [0.7, 'rgba(255,100,30,0.16)'], [1, 'rgba(255,140,50,0.3)']]);
      S.G.haze = vgrad(S, 0, 1, [[0, 'rgba(255,170,90,0)'], [0.5, 'rgba(255,170,90,1)'], [1, 'rgba(255,170,90,0)']]);
    },
    update(dt) {
      const t = S.t;
      for (let i = 0; i < n; i++) {
        const zz = z[i];
        y[i] -= (22 + 70 * zz) * (0.7 + 0.6 * s[i]) * dt;
        x[i] += (Math.sin(t * (0.9 + s[i]) + ph[i]) * 22 + S.wind * (12 + 16 * zz)) * dt;
        if (y[i] < -14) respawn(i, false);
        if (x[i] > S.w + 12) x[i] = -10; else if (x[i] < -12) x[i] = S.w + 10;
      }
      nextBurst -= dt * (0.4 + 0.6 * S.I);
      if (nextBurst <= 0) {
        nextBurst = 3 + S.R() * 5;
        const bx = (0.12 + 0.76 * S.R()) * S.w, by = S.h * (0.86 + 0.08 * S.R());
        // route through the public trigger so the ember pool handles it
        X.burst(bx, by);
      }
    },
    back(ctx) { drawE(ctx, 0, 0.3); },
    front(ctx) {
      const t = S.t, w = S.w, h = S.h;
      ctx.globalAlpha = (0.75 + 0.25 * Math.sin(t * 2.1)) * (0.5 + 0.5 * S.I);
      ctx.fillStyle = S.G.glow; ctx.fillRect(0, h * 0.58, w, h * 0.42);
      // heat shimmer: wavy translucent bands near the bottom
      ctx.fillStyle = '#ffb066';
      for (let b = 0; b < 3; b++) {
        const base = h * (0.76 + b * 0.08), amp = 3 + b * 1.3, thick = 10 + b * 4;
        ctx.globalAlpha = (0.05 - b * 0.006) * (0.5 + 0.5 * S.I);
        ctx.beginPath();
        const step = 26, ph0 = t * (1.4 + b * 0.35) + b * 1.7;
        ctx.moveTo(0, base + Math.sin(ph0) * amp);
        for (let xx = step; xx <= w + step; xx += step) ctx.lineTo(xx, base + Math.sin(xx * 0.022 + ph0) * amp);
        for (let xx = w + step; xx >= 0; xx -= step) ctx.lineTo(xx, base + thick + Math.sin(xx * 0.017 - ph0 * 0.8 + 1) * amp);
        ctx.closePath(); ctx.fill();
      }
      drawE(ctx, 0.3, 1.01);
    },
  };
};

// ------------------------------------------------------------------ ash
BUILD.ash = (S) => {
  let n = 0, x, y, z, ph, s, glowy;
  const respawn = (i, init) => {
    const R = S.R;
    x[i] = R() * S.w; y[i] = init ? R() * S.h : -10 - R() * 40;
    z[i] = R(); ph[i] = R() * TAU; s[i] = R(); glowy[i] = R() < 0.14 ? 1 : 0;
  };
  const drawA = (ctx, z0, z1) => {
    const cnt = Math.round(n * clamp(0.3 + 0.7 * S.I, 0, 1)), t = S.t, sp = S.sp;
    // grey flakes: two batched paths (light / dark)
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? '#8a858c' : '#d2cdd0';
      ctx.globalAlpha = (pass ? 0.6 : 0.62) * (0.6 + 0.4 * S.I);
      ctx.beginPath();
      for (let i = 0; i < cnt; i++) {
        if (glowy[i] || (i & 1) !== pass) continue;
        const zz = z[i]; if (zz < z0 || zz >= z1) continue;
        const r = (1.7 + 3.2 * zz) * S.u, a = t * (0.6 + s[i]) + ph[i], c = Math.cos(a) * r, sn = Math.sin(a) * r;
        ctx.moveTo(x[i] + c, y[i] + sn); ctx.lineTo(x[i] - sn * 0.6, y[i] + c * 0.6); ctx.lineTo(x[i] - c * 0.9, y[i] - sn * 0.9); ctx.lineTo(x[i] + sn * 0.5, y[i] - c * 0.5);
        ctx.closePath();
      }
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < cnt; i++) {
      if (!glowy[i]) continue;
      const zz = z[i]; if (zz < z0 || zz >= z1) continue;
      const fl = 0.55 + 0.45 * Math.sin(t * 6 + ph[i]), r = (5 + 7 * zz) * S.u;
      ctx.globalAlpha = (0.55 + 0.4 * zz) * fl;
      ctx.drawImage(sp.glow[0], x[i] - r, y[i] - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  };
  return {
    init() {
      n = Math.round(70 * S.f);
      x = F32(n); y = F32(n); z = F32(n); ph = F32(n); s = F32(n); glowy = F32(n);
      for (let i = 0; i < n; i++) respawn(i, true);
      S.G.smoke = vgrad(S, 0, S.h * 0.32, [[0, 'rgba(46,40,44,0.5)'], [1, 'rgba(46,40,44,0)']]);
      S.G.blob = blobSprite('#4a4448', 128);
      S.G.bl = [];
      for (let i = 0; i < 5; i++) S.G.bl.push({ x: S.R() * S.w, y: S.R() * S.h * 0.3, s: 0.6 + S.R() * 0.7, v: 3 + S.R() * 6 });
    },
    update(dt) {
      const t = S.t;
      for (let i = 0; i < n; i++) {
        const zz = z[i];
        y[i] += (12 + 30 * zz) * (0.7 + 0.6 * s[i]) * dt;
        x[i] += (Math.sin(t * 0.7 + ph[i]) * 12 + S.wind * (8 + 20 * zz)) * dt;
        if (y[i] > S.h + 10) respawn(i, false);
        if (x[i] > S.w + 10) x[i] = -8; else if (x[i] < -10) x[i] = S.w + 8;
      }
      for (const b of S.G.bl) { b.x += (b.v + S.wind * 2) * dt; if (b.x > S.w + 200) b.x = -260; else if (b.x < -280) b.x = S.w + 190; }
    },
    back(ctx) {
      ctx.globalAlpha = 0.6 + 0.4 * S.I; ctx.fillStyle = S.G.smoke; ctx.fillRect(0, 0, S.w, S.h * 0.32);
      ctx.globalAlpha = 0.16 + 0.1 * S.I;
      for (const b of S.G.bl) { const ww = S.w * 0.9 * b.s; ctx.drawImage(S.G.blob, b.x - ww / 2, b.y - ww * 0.18, ww, ww * 0.36); }
      drawA(ctx, 0, 0.3);
    },
    front(ctx) { drawA(ctx, 0.3, 1.01); },
  };
};

// ------------------------------------------------------------------ sandstorm
BUILD.sandstorm = (S) => {
  let n = 0, x, y, z, v, len, dirS = 1;
  const respawn = (i, init, dir) => {
    const R = S.R;
    y[i] = R() * S.h; z[i] = R(); v[i] = 0.7 + R() * 0.6; len[i] = 0.7 + R() * 0.8;
    x[i] = init ? R() * S.w : (dir > 0 ? -60 - R() * 80 : S.w + 60 + R() * 80);
  };
  const speed = (i) => (320 + 700 * z[i]) * v[i] * (1 + Math.abs(S.wind) * 0.12);
  const drawS = (ctx, z0, z1) => {
    const cnt = Math.round(n * clamp(0.3 + 0.7 * S.I, 0, 1));
    ctx.lineCap = 'round';
    // [zLo, zHi, width, alpha, colour, parity]  (parity splits each depth band into pale + amber streaks)
    const bk = [[0, 0.4, 0.9, 0.3, '#fff0c8', 0], [0, 0.4, 0.9, 0.3, '#c98f52', 1], [0.4, 0.75, 1.3, 0.4, '#fff0c8', 0], [0.4, 0.75, 1.3, 0.4, '#c98f52', 1], [0.75, 1.01, 2, 0.5, '#fff6dc', 0], [0.75, 1.01, 2, 0.5, '#b5793c', 1]];
    for (const [lo0, hi0, lw, al, c, par] of bk) {
      const lo = Math.max(z0, lo0), hi = Math.min(z1, hi0); if (lo >= hi) continue;
      ctx.globalAlpha = al * (0.6 + 0.4 * S.I); ctx.lineWidth = lw * S.u; ctx.strokeStyle = c;
      ctx.beginPath();
      for (let i = par; i < cnt; i += 2) {
        const zz = z[i]; if (zz < lo || zz >= hi) continue;
        const sx = dirS * speed(i);
        ctx.moveTo(x[i], y[i]); ctx.lineTo(x[i] - sx * 0.075 * len[i], y[i] - sx * 0.075 * len[i] * 0.05);
      }
      ctx.stroke();
    }
  };
  return {
    init() {
      n = Math.round(130 * S.f);
      x = F32(n); y = F32(n); z = F32(n); v = F32(n); len = F32(n);
      for (let i = 0; i < n; i++) respawn(i, true, 1);
      S.G.haze = vgrad(S, 0, S.h, [[0, 'rgba(226,178,106,0.7)'], [0.55, 'rgba(226,178,106,0.35)'], [1, 'rgba(210,150,80,0.8)']]);
      S.G.blob = blobSprite('#e2b26a', 128);
      S.G.bl = [];
      for (let i = 0; i < 3; i++) S.G.bl.push({ x: S.R() * S.w, y: (0.15 + S.R() * 0.7) * S.h, s: 0.8 + S.R() * 0.7, v: 40 + S.R() * 60, ph: S.R() * TAU });
    },
    update(dt) {
      const want = S.wind < -0.3 ? -1 : 1;
      dirS += (want - dirS) * (1 - Math.exp(-2 * dt));
      for (let i = 0; i < n; i++) {
        x[i] += dirS * speed(i) * dt;
        if (dirS > 0 ? x[i] > S.w + 80 : x[i] < -80) respawn(i, false, dirS);
      }
      for (const b of S.G.bl) { b.x += dirS * b.v * dt; if (b.x > S.w + 250) b.x = -250; else if (b.x < -250) b.x = S.w + 250; }
    },
    back(ctx) {
      const t = S.t, pulse = 0.5 + 0.5 * Math.sin(t * 1.3) * (0.6 + 0.4 * Math.min(1, Math.abs(S.wind) / 2));
      ctx.globalAlpha = (0.14 + 0.09 * pulse + 0.015 * Math.abs(S.wind)) * (0.5 + 0.5 * S.I);
      ctx.fillStyle = S.G.haze; ctx.fillRect(0, 0, S.w, S.h);
      ctx.globalAlpha = (0.2 + 0.1 * pulse) * (0.5 + 0.5 * S.I);
      for (const b of S.G.bl) { const ww = S.w * 0.9 * b.s; ctx.drawImage(S.G.blob, b.x - ww / 2, b.y - ww * 0.14, ww, ww * 0.28); }
      drawS(ctx, 0, 0.4);
    },
    front(ctx) {
      drawS(ctx, 0.4, 1.01);
    },
  };
};

// ------------------------------------------------------------------ fog
BUILD.fog = (S) => {
  const tint = S.tint || '#cfd9ea';
  let bb = [], fb = [];
  const mk = (cnt, yLo, yHi, sLo, sHi, vLo, vHi) => {
    const a = [];
    for (let i = 0; i < cnt; i++) a.push({ x: (i / cnt) * (S.w + 300) - 150 + S.R() * 40, y: (yLo + S.R() * (yHi - yLo)) * S.h, s: sLo + S.R() * (sHi - sLo), v: (vLo + S.R() * (vHi - vLo)) * (S.R() < 0.2 ? -1 : 1), ph: S.R() * TAU, a: 0.7 + 0.3 * S.R() });
    return a;
  };
  const adv = (arr, dt) => {
    for (const b of arr) {
      b.x += (b.v + S.wind * 4) * dt;
      const ww = S.w * b.s;
      if (b.x - ww / 2 > S.w + 20) b.x = -ww / 2 - 20; else if (b.x + ww / 2 < -20) b.x = S.w + ww / 2 + 20;
    }
  };
  const drawB = (ctx, arr, alpha, ratio) => {
    const t = S.t;
    for (const b of arr) {
      const ww = S.w * b.s, hh = ww * ratio, bob = Math.sin(t * 0.18 + b.ph) * 6;
      ctx.globalAlpha = alpha * b.a * (0.55 + 0.45 * S.I) * (0.85 + 0.15 * Math.sin(t * 0.35 + b.ph));
      ctx.drawImage(S.G.blob, b.x - ww / 2, b.y - hh / 2 + bob, ww, hh);
    }
  };
  return {
    init() {
      S.G.blob = blobSprite(tint, 128, true);
      bb = mk(6, 0.28, 0.95, 0.8, 1.3, 4, 11);
      fb = mk(2, 0.62, 0.95, 0.8, 1.2, 8, 16);
      S.G.band = vgrad(S, S.h * 0.78, S.h, [[0, rgbaStr(tint, 0)], [1, rgbaStr(tint, 0.3)]]);
    },
    update(dt) { adv(bb, dt); adv(fb, dt); },
    back(ctx) { drawB(ctx, bb, 0.36, 0.38); },
    front(ctx) {
      drawB(ctx, fb, 0.13, 0.3);
      ctx.globalAlpha = 0.6 + 0.4 * S.I; ctx.fillStyle = S.G.band; ctx.fillRect(0, S.h * 0.78, S.w, S.h * 0.22);
    },
  };
};
function rgbaStr(h, a) { return rgba(h, a); }

// ------------------------------------------------------------------ ghosts
BUILD.ghosts = (S) => {
  const NG = 5; let ng = 4;
  const gh = [];
  let motes = 0, mx, my, mz, mph;
  const reset = (g, init) => {
    const R = S.R;
    g.bx = (0.12 + 0.76 * R()) * S.w; g.by = (0.16 + 0.62 * R()) * S.h;
    g.dur = 9 + R() * 7; g.age = init ? R() * g.dur : 0;
    g.ph = R() * TAU; g.sc = (0.75 + R() * 0.7) * S.u; g.vx = (R() - 0.5) * 12; g.vy = -(3 + R() * 6);
    g.flip = R() < 0.5 ? -1 : 1; g.sp = 0.25 + R() * 0.3;
  };
  return {
    init() {
      ng = S.w > 700 ? NG : 4; gh.length = 0;
      for (let i = 0; i < ng; i++) { const g = {}; reset(g, true); g.age = (i / ng) * g.dur; gh.push(g); }
      S.G.ghost = ghostSprite();
      S.G.eye = glowSprite('#c8ff7a', 32);
      motes = Math.round(18 * S.f);
      mx = F32(motes); my = F32(motes); mz = F32(motes); mph = F32(motes);
      for (let i = 0; i < motes; i++) { mx[i] = S.R() * S.w; my[i] = S.R() * S.h; mz[i] = S.R(); mph[i] = S.R() * TAU; }
      S.G.mote = glowSprite('#b8ff9a', 32);
      S.G.mist = vgrad(S, S.h * 0.7, S.h, [[0, 'rgba(120,90,190,0)'], [1, 'rgba(120,90,190,0.2)']]);
    },
    update(dt) {
      for (const g of gh) {
        g.age += dt; g.bx += g.vx * dt; g.by += g.vy * dt;
        if (g.age > g.dur) reset(g, false);
      }
      for (let i = 0; i < motes; i++) {
        my[i] -= (6 + 14 * mz[i]) * dt; mx[i] += (Math.sin(S.t * 0.6 + mph[i]) * 8 + S.wind * 5) * dt;
        if (my[i] < -8) { my[i] = S.h + 8; mx[i] = S.R() * S.w; }
        if (mx[i] > S.w + 8) mx[i] = -8; else if (mx[i] < -8) mx[i] = S.w + 8;
      }
    },
    back(ctx) {
      ctx.globalAlpha = 0.5 + 0.5 * S.I; ctx.fillStyle = S.G.mist; ctx.fillRect(0, S.h * 0.7, S.w, S.h * 0.3);
      ctx.globalCompositeOperation = 'lighter';
      const cnt = Math.round(motes * (0.3 + 0.7 * S.I));
      for (let i = 0; i < cnt; i++) {
        if (mz[i] > 0.45) continue;
        const r = 5 + 5 * mz[i], tw = 0.5 + 0.5 * Math.sin(S.t * 1.7 + mph[i]);
        ctx.globalAlpha = 0.28 * tw; ctx.drawImage(S.G.mote, mx[i] - r, my[i] - r, r * 2, r * 2);
      }
    },
    front(ctx) {
      const t = S.t, img = S.G.ghost;
      for (let i = 0; i < gh.length; i++) {
        const g = gh[i], p = g.age / g.dur;
        const env = Math.pow(Math.sin(Math.PI * clamp(p, 0, 1)), 1.4) * (0.35 + 0.65 * S.I);
        if (env < 0.01) continue;
        const px = g.bx + Math.sin(t * g.sp + g.ph) * 34 * S.u, py = g.by + Math.sin(t * g.sp * 1.7 + g.ph * 2) * 12 * S.u;
        const tilt = Math.cos(t * g.sp + g.ph) * 0.12 * g.flip;
        const bobW = 1 + 0.03 * Math.sin(t * 2.3 + g.ph);
        const sw = 72 * g.sc * g.flip * bobW, sh = 88 * g.sc;
        const vxn = Math.cos(t * g.sp + g.ph) * g.sp * 34 * S.u; // horizontal velocity sign
        // echoes (trailing afterimages)
        for (let k = 1; k >= 0; k--) {
          const off = k * 10 * -Math.sign(vxn || 1) * S.u;
          ctx.save(); ctx.translate(px + off, py + k * 5); ctx.rotate(tilt);
          ctx.globalAlpha = env * (k === 0 ? 0.3 : 0.09);
          ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
          ctx.restore();
        }
        // eye glow
        ctx.save(); ctx.translate(px, py); ctx.rotate(tilt);
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.55 + 0.45 * Math.sin(t * 2.6 + g.ph), er = 7 * g.sc;
        ctx.globalAlpha = env * 0.55 * pulse;
        ctx.drawImage(S.G.eye, -8 * g.sc - er, -7 * g.sc - er, er * 2, er * 2);
        ctx.drawImage(S.G.eye, 8 * g.sc - er, -7 * g.sc - er, er * 2, er * 2);
        ctx.restore();
      }
      // near motes
      ctx.globalCompositeOperation = 'lighter';
      const cnt = Math.round(motes * (0.3 + 0.7 * S.I));
      for (let i = 0; i < cnt; i++) {
        if (mz[i] <= 0.45) continue;
        const r = 5 + 7 * mz[i], tw = 0.5 + 0.5 * Math.sin(S.t * 2.1 + mph[i]);
        ctx.globalAlpha = 0.5 * tw; ctx.drawImage(S.G.mote, mx[i] - r, my[i] - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };
};

// ------------------------------------------------------------------ underwater current
BUILD.current = (S) => {
  let n = 0, x, y, z, ph, s;
  const respawn = (i, init) => {
    const R = S.R;
    x[i] = R() * S.w; y[i] = init ? R() * S.h : S.h + 10 + R() * 40;
    z[i] = R(); ph[i] = R() * TAU; s[i] = R();
  };
  const drawBub = (ctx, z0, z1) => {
    const cnt = Math.round(n * clamp(0.3 + 0.7 * S.I, 0, 1));
    for (let pass = 0; pass < 3; pass++) {
      ctx.beginPath();
      if (pass === 0) { ctx.fillStyle = '#bff2ff'; ctx.globalAlpha = 0.07; }
      else if (pass === 1) { ctx.strokeStyle = '#d6f8ff'; ctx.lineWidth = 1; ctx.globalAlpha = 0.4; }
      else { ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.55; }
      for (let i = 0; i < cnt; i++) {
        const zz = z[i]; if (zz < z0 || zz >= z1) continue;
        const r = (1.6 + 5.2 * zz) * S.u * (0.8 + 0.4 * s[i]);
        if (pass === 2) { ctx.moveTo(x[i] - r * 0.35 + r * 0.25, y[i] - r * 0.4); ctx.arc(x[i] - r * 0.35, y[i] - r * 0.4, Math.max(0.5, r * 0.22), 0, TAU); }
        else { ctx.moveTo(x[i] + r, y[i]); ctx.arc(x[i], y[i], r, 0, TAU); }
      }
      if (pass === 1) ctx.stroke(); else ctx.fill();
    }
  };
  return {
    init() {
      n = Math.round(48 * S.f);
      x = F32(n); y = F32(n); z = F32(n); ph = F32(n); s = F32(n);
      for (let i = 0; i < n; i++) respawn(i, true);
      S.G.tile = causticTile(160);
      S.G.pat = new WeakMap();
      S.G.shaft = vgrad(S, 0, S.h * 0.75, [[0, 'rgba(190,245,255,0.55)'], [1, 'rgba(190,245,255,0)']]);
      S.G.fade = [0.9, 0.7, 0.5, 0.3, 0.15];
    },
    update(dt) {
      const t = S.t;
      for (let i = 0; i < n; i++) {
        const zz = z[i];
        y[i] -= (16 + 52 * zz) * (0.7 + 0.6 * s[i]) * dt;
        x[i] += (Math.sin(t * (1 + s[i]) + ph[i]) * 14 * (0.4 + zz) + S.wind * (10 + 8 * zz)) * dt;
        if (y[i] < -10) respawn(i, false);
        if (x[i] > S.w + 10) x[i] = -8; else if (x[i] < -10) x[i] = S.w + 8;
      }
    },
    back(ctx) {
      const t = S.t, w = S.w, h = S.h;
      // light shafts
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const cx = w * (0.12 + 0.32 * i) + Math.sin(t * 0.17 + i * 1.9) * 30, ww = w * (0.1 + 0.03 * ((i * 7) % 3));
        ctx.save(); ctx.transform(1, 0, -0.32, 1, 0, 0);
        ctx.globalAlpha = (0.05 + 0.03 * Math.sin(t * 0.4 + i * 2.2)) * (0.5 + 0.5 * S.I);
        ctx.fillStyle = S.G.shaft; ctx.fillRect(cx + h * 0.1, 0, ww, h * 0.75);
        ctx.restore();
      }
      // caustics: two drifting tiled layers over the upper part of the screen, fading downward in strips
      let pat = S.G.pat.get(ctx);
      if (!pat) { pat = ctx.createPattern(S.G.tile, 'repeat'); S.G.pat.set(ctx, pat); }
      ctx.fillStyle = pat;
      for (let L = 0; L < 2; L++) {
        const sc = L ? 1.5 : 1, per = 160 * sc, ox = ((t * (L ? -9 : 12)) % per + per) % per, oy = ((t * (L ? 6 : 4)) % per + per) % per;
        const strips = L ? 1 : 2, baseA = (L ? 0.06 : 0.08) * (0.5 + 0.5 * S.I);
        ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
        for (let k = 0; k < strips; k++) {
          ctx.globalAlpha = baseA * S.G.fade[k];
          ctx.fillRect(-160, (h * 0.17 * k - oy) / sc, w / sc + 320, h * 0.17 / sc + 1);
        }
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
      drawBub(ctx, 0, 0.3);
    },
    front(ctx) { drawBub(ctx, 0.3, 1.01); },
  };
};

// ------------------------------------------------------------------ leaves
BUILD.leaves = (S) => {
  let n = 0, x, y, z, ph, rot, vr, ci, s;
  const respawn = (i, init) => {
    const R = S.R;
    x[i] = R() * S.w * 1.2 - S.w * 0.1; y[i] = init ? R() * S.h : -20 - R() * 60;
    z[i] = R(); ph[i] = R() * TAU; rot[i] = R() * TAU; vr[i] = (R() - 0.5) * 3; ci[i] = (R() * 4) | 0; s[i] = R();
  };
  const drawL = (ctx, z0, z1) => {
    const cnt = Math.round(n * clamp(0.3 + 0.7 * S.I, 0, 1)), d = S.dpr, t = S.t;
    for (let i = 0; i < cnt; i++) {
      const zz = z[i]; if (zz < z0 || zz >= z1) continue;
      const sc = (0.5 + 0.7 * zz) * S.u, c = Math.cos(rot[i]), sn = Math.sin(rot[i]), flip = Math.cos(t * (1.6 + s[i]) + ph[i]);
      ctx.globalAlpha = 0.5 + 0.45 * zz;
      ctx.setTransform(c * d, sn * d, -sn * flip * d, c * flip * d, x[i] * d, y[i] * d);
      ctx.drawImage(S.sp.leaf[ci[i]], -11 * sc, -7 * sc, 22 * sc, 14 * sc);
    }
    ctx.setTransform(d, 0, 0, d, 0, 0);
  };
  return {
    init() {
      n = Math.round(20 * S.f);
      x = F32(n); y = F32(n); z = F32(n); ph = F32(n); rot = F32(n); vr = F32(n); ci = F32(n); s = F32(n);
      for (let i = 0; i < n; i++) respawn(i, true);
    },
    update(dt) {
      const t = S.t;
      for (let i = 0; i < n; i++) {
        const zz = z[i];
        y[i] += (30 + 34 * zz) * (0.8 + 0.4 * s[i]) * (1 + 0.35 * Math.sin(t * 1.3 + ph[i])) * dt;
        x[i] += (S.wind * (16 + 30 * zz) + Math.sin(t * 1.1 + ph[i]) * 36 * (0.5 + zz)) * dt;
        rot[i] += (vr[i] + Math.cos(t * 1.1 + ph[i]) * 0.9) * dt;
        if (y[i] > S.h + 20) respawn(i, false);
        if (x[i] > S.w + 30) x[i] = -24; else if (x[i] < -34) x[i] = S.w + 24;
      }
    },
    back(ctx) { drawL(ctx, 0, 0.3); },
    front(ctx) { drawL(ctx, 0.3, 1.01); },
  };
};

// ------------------------------------------------------------------ fireflies
BUILD.fireflies = (S) => {
  let n = 0, bx, by, z, ph, fx, fy, bs;
  const drawF = (ctx, z0, z1) => {
    const cnt = Math.round(n * clamp(0.3 + 0.7 * S.I, 0, 1)), t = S.t;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < cnt; i++) {
      const zz = z[i]; if (zz < z0 || zz >= z1) continue;
      const bl = Math.pow(Math.max(0, Math.sin(t * bs[i] + ph[i])), 2);
      const a = 0.12 + 0.88 * bl; if (a < 0.14) continue;
      const px = bx[i] + Math.sin(t * fx[i] + ph[i]) * 28 * (0.5 + zz), py = by[i] + Math.cos(t * fy[i] + ph[i] * 1.3) * 20 * (0.5 + zz);
      const r = (6 + 11 * zz) * S.u * (0.75 + 0.35 * bl);
      ctx.globalAlpha = a * (0.35 + 0.5 * zz);
      ctx.drawImage(S.G.glow, px - r, py - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  };
  return {
    init() {
      n = Math.round(22 * S.f);
      bx = F32(n); by = F32(n); z = F32(n); ph = F32(n); fx = F32(n); fy = F32(n); bs = F32(n);
      for (let i = 0; i < n; i++) { bx[i] = S.R() * S.w; by[i] = (0.1 + S.R() * 0.85) * S.h; z[i] = S.R(); ph[i] = S.R() * TAU; fx[i] = 0.3 + S.R() * 0.5; fy[i] = 0.25 + S.R() * 0.5; bs[i] = 0.7 + S.R() * 1.1; }
      S.G.glow = glowSprite('#d6ff6a', 64);
    },
    update(dt) {
      for (let i = 0; i < n; i++) {
        bx[i] += (S.wind * 3 + 2) * dt; by[i] -= (1.5 + 2.5 * z[i]) * dt;
        if (bx[i] > S.w + 40) bx[i] = -40; else if (bx[i] < -40) bx[i] = S.w + 40;
        if (by[i] < -30) by[i] = S.h + 30;
      }
    },
    back(ctx) { drawF(ctx, 0, 0.35); },
    front(ctx) { drawF(ctx, 0.35, 1.01); },
  };
};

// ------------------------------------------------------------------ quake: dust haze + falling grit
BUILD.quake = (S, X) => {
  let n = 0, x, y, z, ph, s, acc = 0;
  return {
    init() {
      n = Math.round(34 * S.f);
      x = F32(n); y = F32(n); z = F32(n); ph = F32(n); s = F32(n);
      for (let i = 0; i < n; i++) { x[i] = S.R() * S.w; y[i] = S.R() * S.h; z[i] = S.R(); ph[i] = S.R() * TAU; s[i] = S.R(); }
      S.G.haze = vgrad(S, S.h * 0.55, S.h, [[0, 'rgba(150,118,84,0)'], [1, 'rgba(150,118,84,0.46)']]);
      S.G.top = vgrad(S, 0, S.h * 0.22, [[0, 'rgba(120,96,70,0.28)'], [1, 'rgba(120,96,70,0)']]);
      S.G.dot = dotSprite('#c8ab84', 16);
      S.G.blob = blobSprite('#a88b66', 128);
    },
    update(dt) {
      for (let i = 0; i < n; i++) {
        x[i] += (Math.sin(S.t * 0.5 + ph[i]) * 6 + S.wind * 6) * dt; y[i] += (3 + 9 * z[i] + Math.sin(S.t * 0.7 + ph[i]) * 3) * dt;
        if (y[i] > S.h + 6) { y[i] = -6; x[i] = S.R() * S.w; }
        if (x[i] > S.w + 6) x[i] = -6; else if (x[i] < -6) x[i] = S.w + 6;
      }
      // sustained rumble: occasional pebbles proportional to intensity
      acc += dt * S.I * 5;
      while (acc >= 1) { acc -= 1; X.spawnE(0, S.R() * S.w, -8, (S.R() - 0.5) * 20, 40 + S.R() * 80, 1.4 + S.R(), (2 + S.R() * 3) * S.u, (S.R() * 3) | 0); }
    },
    back(ctx) {
      const pulse = 0.85 + 0.15 * Math.sin(S.t * 0.8);
      ctx.globalAlpha = (0.55 + 0.45 * S.I) * pulse; ctx.fillStyle = S.G.haze; ctx.fillRect(0, S.h * 0.55, S.w, S.h * 0.45);
      ctx.fillStyle = S.G.top; ctx.fillRect(0, 0, S.w, S.h * 0.22);
    },
    front(ctx) {
      const cnt = Math.round(n * (0.3 + 0.7 * S.I));
      for (let i = 0; i < cnt; i++) {
        const r = (1.2 + 1.8 * z[i]) * S.u;
        ctx.globalAlpha = 0.18 + 0.3 * z[i];
        ctx.drawImage(S.G.dot, x[i] - r, y[i] - r, r * 2, r * 2);
      }
    },
  };
};

BUILD.none = null;
