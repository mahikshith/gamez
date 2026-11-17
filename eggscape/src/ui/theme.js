// Menu theme packs (2026-11-16): the worn hen skin re-dresses the whole menu, not only the particles. A pack (data/skin-ui.js
// PACKS, per-skin `pal` overrides) names five things, all painted here and all cached:
//   bg     a full-screen scene (title, shop, extras, practice) drawn once into a canvas per size
//   frame  corner ornaments + a striped/stitched border on every card (ui.panel)
//   button a material on the buttons: wrapped present with a bow, stitched leather, studded metal
//   icon   the shape set of the pause bars and the levels grid
//   logo   how the title letters are dressed (Santa hat + snow, crown, beanie ...)
// Nothing here runs per particle; scenes and ornaments are canvases built once, panels/buttons add a few paths.
const TAU = Math.PI * 2;
const mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); const g = c.getContext('2d'); f(g, c.width, c.height); return c; };
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const vg = (g, y0, y1, stops) => { const r = g.createLinearGradient(0, y0, 0, y1); stops.forEach((c, i) => r.addColorStop(i / (stops.length - 1), c)); return r; };
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
const glowAt = (g, x, y, r, col) => { const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, col); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); };
const hills = (g, W, y, amp, col, seed, bottom, f = 1) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, bottom); for (let x = 0; x <= W; x += 8) g.lineTo(x, y - amp * (0.55 * Math.sin(x * 0.011 * f + seed) + 0.45 * Math.sin(x * 0.027 * f + seed * 2.3))); g.lineTo(W, bottom); g.closePath(); g.fill(); };
const stars = (g, W, H, n, seed, k, col = '#fff') => { const R = rng(seed); g.fillStyle = col; for (let i = 0; i < n; i++) { g.globalAlpha = 0.3 + 0.6 * R(); g.beginPath(); g.arc(R() * W, R() * H, (0.6 + 1.3 * R()) * k, 0, TAU); g.fill(); } g.globalAlpha = 1; };
const bulbs = (g, W, k, y0, sag, cols, step = 24) => { // a sagging string of lights across the top
  g.strokeStyle = 'rgba(20,30,20,0.8)'; g.lineWidth = 1.6 * k; const n = Math.ceil(W / (W * 0.5)), seg = W / n;
  for (let s = 0; s < n; s++) { g.beginPath(); g.moveTo(s * seg, y0); g.quadraticCurveTo(s * seg + seg / 2, y0 + sag * 2, (s + 1) * seg, y0); g.stroke(); }
  let i = 0;
  for (let s = 0; s < n; s++) for (let x = step * k * 0.5; x < seg; x += step * k) { const t = x / seg, yy = (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * (y0 + sag * 2) + t * t * y0, c = cols[i++ % cols.length]; glowAt(g, s * seg + x, yy + 5 * k, 11 * k, c.replace(')', ',0.55)').replace('rgb(', 'rgba(')); g.fillStyle = c; g.beginPath(); g.ellipse(s * seg + x, yy + 5 * k, 3 * k, 4.2 * k, 0, 0, TAU); g.fill(); }
};
const LIGHTS = ['rgb(255,80,70)', 'rgb(255,214,90)', 'rgb(110,220,120)', 'rgb(110,180,255)'];
const house = (g, x, y, w, h, wall, roof, snow, lit, k) => { // y is the ground line
  g.fillStyle = wall; g.fillRect(x, y - h, w, h);
  g.fillStyle = roof; g.beginPath(); g.moveTo(x - 5 * k, y - h); g.lineTo(x + w / 2, y - h - w * 0.45); g.lineTo(x + w + 5 * k, y - h); g.fill();
  if (snow) { g.fillStyle = '#f4faff'; g.beginPath(); g.moveTo(x - 6 * k, y - h + 1); g.lineTo(x + w / 2, y - h - w * 0.47); g.lineTo(x + w + 6 * k, y - h + 1); g.quadraticCurveTo(x + w * 0.8, y - h - 5 * k, x + w * 0.6, y - h + 2 * k); g.quadraticCurveTo(x + w * 0.4, y - h - 6 * k, x + w * 0.2, y - h + 2 * k); g.quadraticCurveTo(x + w * 0.1, y - h - 4 * k, x - 6 * k, y - h + 1); g.fill(); }
  if (lit) for (const [fx, fy] of [[0.18, 0.28], [0.58, 0.28], [0.38, 0.62]]) { const wx = x + w * fx, wy = y - h + h * fy, ww = w * 0.24, wh = h * 0.26; glowAt(g, wx + ww / 2, wy + wh / 2, ww * 1.4, 'rgba(255,200,90,0.5)'); g.fillStyle = lit; g.fillRect(wx, wy, ww, wh); }
};
const pine = (g, x, y, w, h, col, snow) => { g.fillStyle = col; for (let i = 0; i < 3; i++) { const ty = y - h + (h * i) / 3.6, bw = w * (0.45 + 0.28 * i); g.beginPath(); g.moveTo(x, ty); g.lineTo(x + bw, ty + h * 0.42); g.lineTo(x - bw, ty + h * 0.42); g.fill(); if (snow) { g.fillStyle = '#f2f9ff'; g.beginPath(); g.moveTo(x, ty); g.lineTo(x + bw * 0.55, ty + h * 0.23); g.quadraticCurveTo(x + bw * 0.2, ty + h * 0.17, x, ty + h * 0.24); g.quadraticCurveTo(x - bw * 0.2, ty + h * 0.17, x - bw * 0.55, ty + h * 0.23); g.fill(); g.fillStyle = col; } } };

// ---- backdrops. p = the row's palette; gy = the ground line; k = size unit
const BG = {
  village(g, W, H, gy, p, k) { // a snowy night village: warm windows, a lit tree, string lights
    g.fillStyle = vg(g, 0, gy, p.sky); g.fillRect(0, 0, W, H); stars(g, W, gy * 0.6, 70, 3, k);
    glowAt(g, W * 0.8, H * 0.13, 60 * k, 'rgba(255,248,210,0.5)'); g.fillStyle = '#fffbe8'; g.beginPath(); g.arc(W * 0.8, H * 0.13, 17 * k, 0, TAU); g.fill();
    hills(g, W, gy - 8 * k, 26 * k, p.far, 1, H); hills(g, W, gy + 4 * k, 14 * k, p.mid, 4, H, 1.6);
    const R = rng(7); const cols = [['#7a4a3a', '#a8483a'], ['#5a6a8a', '#8a3a3a'], ['#8a6a4a', '#4a5a7a'], ['#6a4a5a', '#7a3a3a']];
    for (let i = 0; i < 6; i++) { const w = (36 + 26 * R()) * k, x = (i + 0.2 + 0.5 * R()) * W / 6.2, c = cols[i % 4]; house(g, x, gy + 2 * k - (i % 2) * 4 * k, w, (30 + 20 * R()) * k, c[0], c[1], true, '#ffd070', k); }
    g.fillStyle = vg(g, gy, H, p.ground); g.fillRect(0, gy, W, H - gy); hills(g, W, gy + 6 * k, 5 * k, '#f6fbff', 2, gy + 30 * k, 2);
    pine(g, W * 0.9, gy + 6 * k, 38 * k, 120 * k, '#1f6a3a', true); const T = rng(11); for (let i = 0; i < 16; i++) { const yy = gy - 100 * k + T() * 100 * k, hw = 4 + (yy - gy + 100 * k) * 0.28 / k; g.fillStyle = LIGHTS[i % 4]; g.beginPath(); g.arc(W * 0.9 + (T() - 0.5) * hw * k * 1.4, yy, 2.4 * k, 0, TAU); g.fill(); }
    g.fillStyle = '#ffd24a'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4 * k : 10 * k; g.lineTo(W * 0.9 + Math.cos(a) * r, gy - 126 * k + Math.sin(a) * r); } g.fill();
    bulbs(g, W, k, 2 * k, 16 * k, LIGHTS);
  },
  cabin(g, W, H, gy, p, k) { // a cosy cabin room: planks, a snowy window, a crackling fire
    g.fillStyle = vg(g, 0, gy, p.sky); g.fillRect(0, 0, W, gy);
    g.strokeStyle = 'rgba(40,16,4,0.35)'; g.lineWidth = 1.5 * k; for (let x = 0; x < W; x += 34 * k) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, gy); g.stroke(); }
    const wx = W * 0.08, wy = H * 0.12, ww = Math.min(W * 0.38, 150 * k), wh = ww * 1.05; // the window
    g.fillStyle = '#5a3414'; g.fillRect(wx - 7 * k, wy - 7 * k, ww + 14 * k, wh + 14 * k); g.fillStyle = vg(g, wy, wy + wh, ['#1a2a5a', '#3a5a9a']); g.fillRect(wx, wy, ww, wh);
    const S = rng(5); g.fillStyle = '#fff'; for (let i = 0; i < 26; i++) { g.globalAlpha = 0.7; g.beginPath(); g.arc(wx + S() * ww, wy + S() * wh, (1 + S() * 1.6) * k, 0, TAU); g.fill(); } g.globalAlpha = 1;
    g.fillStyle = '#5a3414'; g.fillRect(wx + ww / 2 - 2.5 * k, wy, 5 * k, wh); g.fillRect(wx, wy + wh / 2 - 2.5 * k, ww, 5 * k); g.fillStyle = '#f2f8ff'; g.fillRect(wx - 9 * k, wy + wh + 5 * k, ww + 18 * k, 7 * k);
    const fx = W * 0.62, fw = Math.min(W * 0.32, 130 * k), fh = fw * 0.95, fy = gy - fh; // the fireplace
    g.fillStyle = '#6a5a52'; g.fillRect(fx - 12 * k, fy - 12 * k, fw + 24 * k, fh + 12 * k); g.fillStyle = '#2a1608'; rr(g, fx + fw * 0.12, fy + fh * 0.2, fw * 0.76, fh * 0.8, fw * 0.3); g.fill();
    glowAt(g, fx + fw / 2, fy + fh * 0.7, fw * 1.5, 'rgba(255,150,50,0.5)');
    for (const [dx, sc, c] of [[-0.16, 0.8, '#ff7a1e'], [0.14, 0.7, '#ff7a1e'], [0, 1, '#ff9a2a']]) { g.fillStyle = c; g.beginPath(); const cx = fx + fw / 2 + dx * fw, b = fy + fh, h2 = fh * 0.55 * sc; g.moveTo(cx - fw * 0.1, b); g.quadraticCurveTo(cx - fw * 0.12, b - h2 * 0.6, cx, b - h2); g.quadraticCurveTo(cx + fw * 0.12, b - h2 * 0.6, cx + fw * 0.1, b); g.fill(); g.fillStyle = '#ffe27a'; g.beginPath(); g.moveTo(cx - fw * 0.05, b); g.quadraticCurveTo(cx, b - h2 * 0.7, cx + fw * 0.05, b); g.fill(); }
    g.fillStyle = '#4a2a10'; g.fillRect(fx - 16 * k, fy - 16 * k, fw + 32 * k, 8 * k); for (let i = 0; i < 3; i++) { g.fillStyle = ['#d8302a', '#fff', '#2a9a4a'][i]; g.beginPath(); g.moveTo(fx + (10 + i * 26) * k, fy - 8 * k); g.lineTo(fx + (22 + i * 26) * k, fy - 8 * k); g.lineTo(fx + (20 + i * 26) * k, fy + 14 * k); g.quadraticCurveTo(fx + (14 + i * 26) * k, fy + 20 * k, fx + (10 + i * 26) * k, fy + 12 * k); g.fill(); } // stockings
    g.fillStyle = vg(g, gy, H, p.ground); g.fillRect(0, gy, W, H - gy); g.strokeStyle = 'rgba(30,12,2,0.4)'; for (let y = gy + 18 * k; y < H; y += 20 * k) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.fillStyle = 'rgba(40,14,6,0.5)'; g.fillRect(0, gy - 4 * k, W, 6 * k); bulbs(g, W, k, 2 * k, 14 * k, ['rgb(255,200,110)', 'rgb(255,150,90)']);
  },
  hall(g, W, H, gy, p, k) { // a castle hall: stone, banners, arched windows, a carpet
    g.fillStyle = vg(g, 0, gy, p.sky); g.fillRect(0, 0, W, gy); g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = k;
    for (let y = 0, r = 0; y < gy; y += 26 * k, r++) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); for (let x = (r % 2) * 30 * k; x < W; x += 60 * k) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 26 * k); g.stroke(); } }
    for (const fx of [0.3, 0.7]) { const x = W * fx, w = 52 * k, y = H * 0.2; g.fillStyle = vg(g, y, y + 130 * k, p.win); g.beginPath(); g.moveTo(x - w / 2, y + 120 * k); g.lineTo(x - w / 2, y + 30 * k); g.arc(x, y + 30 * k, w / 2, Math.PI, 0); g.lineTo(x + w / 2, y + 120 * k); g.fill(); g.strokeStyle = p.trim; g.lineWidth = 4 * k; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.07)'; g.beginPath(); g.moveTo(x - w / 2, y + 40 * k); g.lineTo(x + w / 2, y + 40 * k); g.lineTo(x + w * 1.5, gy); g.lineTo(x - w * 0.5, gy); g.fill(); }
    for (const fx of [0.08, 0.5, 0.92]) { const x = W * fx, w = 44 * k, h2 = (fx === 0.5 ? 120 : 160) * k; g.fillStyle = p.accent; g.beginPath(); g.moveTo(x - w / 2, 0); g.lineTo(x + w / 2, 0); g.lineTo(x + w / 2, h2); g.lineTo(x, h2 - 18 * k); g.lineTo(x - w / 2, h2); g.fill(); g.fillStyle = p.trim; g.fillRect(x - w / 2, 0, w, 6 * k); g.beginPath(); g.arc(x, h2 * 0.45, 9 * k, 0, TAU); g.fill(); g.strokeStyle = p.trim; g.lineWidth = 2 * k; g.strokeRect(x - w / 2 + 4 * k, 10 * k, w - 8 * k, h2 - 32 * k); }
    glowAt(g, W / 2, 0, 190 * k, 'rgba(255,225,150,0.35)');
    g.fillStyle = vg(g, gy, H, p.ground); g.fillRect(0, gy, W, H - gy); const cw = Math.min(W * 0.5, 200 * k); g.fillStyle = p.accent; g.beginPath(); g.moveTo(W / 2 - cw * 0.35, gy); g.lineTo(W / 2 + cw * 0.35, gy); g.lineTo(W / 2 + cw * 0.6, H); g.lineTo(W / 2 - cw * 0.6, H); g.fill(); g.strokeStyle = p.trim; g.lineWidth = 3 * k; g.stroke();
  },
  hills(g, W, H, gy, p, k) { // the countryside by world: farm, woods, bayou
    g.fillStyle = vg(g, 0, gy, p.sky); g.fillRect(0, 0, W, H); glowAt(g, W * 0.2, H * 0.14, 80 * k, p.sun); g.fillStyle = '#fffbe0'; g.beginPath(); g.arc(W * 0.2, H * 0.14, 20 * k, 0, TAU); g.fill();
    const R = rng(9); g.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 4; i++) { const x = R() * W, y = H * (0.08 + 0.2 * R()); for (let j = 0; j < 3; j++) { g.beginPath(); g.ellipse(x + j * 22 * k, y + (j % 2) * 4 * k, 26 * k, 11 * k, 0, 0, TAU); g.fill(); } }
    hills(g, W, gy - 40 * k, 34 * k, p.far, 2, H); hills(g, W, gy - 14 * k, 24 * k, p.mid, 5, H, 1.4);
    for (let i = 0; i < 11; i++) { const x = (i + R()) * W / 10.5, y = gy - 6 * k + R() * 16 * k, s = (0.8 + 0.6 * R()) * k; if (p.trees === 'pine') pine(g, x, y, 14 * s, 48 * s, p.tree, false); else { g.fillStyle = '#5a3a1a'; g.fillRect(x - 2 * s, y - 14 * s, 4 * s, 14 * s); g.fillStyle = i % 2 ? p.tree : p.tree2; g.beginPath(); g.arc(x, y - 24 * s, 15 * s, 0, TAU); g.fill(); } }
    g.fillStyle = vg(g, gy, H, p.ground); g.fillRect(0, gy, W, H - gy); hills(g, W, gy + 3 * k, 6 * k, p.ground[0], 3, gy + 30 * k, 2);
    if (p.mist) { g.fillStyle = vg(g, gy - 70 * k, gy + 20 * k, ['rgba(220,240,220,0)', 'rgba(220,240,220,0.4)', 'rgba(220,240,220,0)']); g.fillRect(0, gy - 70 * k, W, 90 * k); }
    if (p.fence) { g.strokeStyle = '#a07a44'; g.lineWidth = 3 * k; g.beginPath(); for (let x = 6 * k; x < W; x += 22 * k) { g.moveTo(x, gy + 2 * k); g.lineTo(x, gy - 14 * k); } g.moveTo(0, gy - 10 * k); g.lineTo(W, gy - 10 * k); g.moveTo(0, gy - 3 * k); g.lineTo(W, gy - 3 * k); g.stroke(); }
  },
  harbor(g, W, H, gy, p, k) { // the sea: a pirate cove, the reef, a storm
    const R = rng(13);
    if (p.mode === 'under') {
      g.fillStyle = vg(g, 0, H, p.sky); g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,0.07)'; for (let i = 0; i < 6; i++) { const x = W * (0.1 + i * 0.17); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 40 * k, 0); g.lineTo(x + 90 * k - i * 10 * k, gy); g.lineTo(x - 30 * k, gy); g.fill(); }
      g.fillStyle = vg(g, gy, H, p.ground); hills(g, W, gy, 10 * k, p.ground[0], 3, H, 1.6);
      for (let i = 0; i < 9; i++) { const x = (i + R()) * W / 8.5, y = gy + 2 * k, h2 = (20 + 30 * R()) * k; g.fillStyle = ['#ff7a6a', '#ffb04a', '#c86aff'][i % 3]; g.beginPath(); g.moveTo(x - 7 * k, y); g.quadraticCurveTo(x - 10 * k, y - h2, x, y - h2); g.quadraticCurveTo(x + 10 * k, y - h2, x + 7 * k, y); g.fill(); }
      g.fillStyle = 'rgba(20,60,90,0.5)'; for (let i = 0; i < 5; i++) { const x = R() * W, y = H * (0.2 + 0.4 * R()); g.beginPath(); g.ellipse(x, y, 12 * k, 5 * k, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x + 11 * k, y); g.lineTo(x + 20 * k, y - 5 * k); g.lineTo(x + 20 * k, y + 5 * k); g.fill(); }
      return;
    }
    g.fillStyle = vg(g, 0, gy, p.sky); g.fillRect(0, 0, W, H); const hz = gy * 0.78;
    g.fillStyle = p.mode === 'storm' ? 'rgba(40,50,70,0.9)' : 'rgba(255,255,255,0.8)'; for (let i = 0; i < 5; i++) { const x = R() * W, y = hz * (0.1 + 0.45 * R()); for (let j = 0; j < 4; j++) { g.beginPath(); g.ellipse(x + j * 24 * k, y + (j % 2) * 5 * k, 32 * k, 13 * k, 0, 0, TAU); g.fill(); } }
    if (p.ship) { const x = W * 0.72, y = hz; g.fillStyle = '#2a1608'; g.beginPath(); g.moveTo(x - 46 * k, y - 8 * k); g.lineTo(x + 50 * k, y - 8 * k); g.lineTo(x + 34 * k, y + 8 * k); g.lineTo(x - 30 * k, y + 8 * k); g.fill(); g.fillRect(x - 2 * k, y - 80 * k, 4 * k, 72 * k); g.fillStyle = '#f4e8c8'; g.beginPath(); g.moveTo(x + 4 * k, y - 76 * k); g.lineTo(x + 40 * k, y - 18 * k); g.lineTo(x + 4 * k, y - 18 * k); g.fill(); g.beginPath(); g.moveTo(x - 4 * k, y - 66 * k); g.lineTo(x - 34 * k, y - 18 * k); g.lineTo(x - 4 * k, y - 18 * k); g.fill(); }
    for (let i = 0; i < 6; i++) { const y = hz + i * (H - hz) / 6; g.fillStyle = vg(g, y, y + (H - hz) / 6 + 4, [p.ground[0], p.ground[1]]); g.globalAlpha = 0.55 + i * 0.08; g.beginPath(); g.moveTo(0, H); g.lineTo(0, y); for (let x = 0; x <= W; x += 10) g.lineTo(x, y + Math.sin(x * 0.03 + i * 1.7) * 4 * k); g.lineTo(W, H); g.fill(); } g.globalAlpha = 1;
    if (p.mode === 'storm') { g.strokeStyle = 'rgba(200,220,255,0.45)'; g.lineWidth = 1.5 * k; g.beginPath(); for (let i = 0; i < 90; i++) { const x = R() * W, y = R() * H; g.moveTo(x, y); g.lineTo(x - 5 * k, y + 16 * k); } g.stroke(); }
  },
  cave(g, W, H, gy, p, k) { // crystal cavern / fire station wall / laboratory
    const R = rng(17); g.fillStyle = vg(g, 0, H, p.sky); g.fillRect(0, 0, W, H);
    if (p.mode === 'lab') { g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = k; for (let x = 0; x < W; x += 36 * k) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, gy); g.stroke(); } for (let y = 0; y < gy; y += 36 * k) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      for (const sy of [0.32, 0.52]) { const y = H * sy; g.fillStyle = '#8a98a8'; g.fillRect(0, y, W, 6 * k); for (let x = 20 * k; x < W - 20 * k; x += 46 * k) { const c = p.glow[(x / k | 0) % p.glow.length], h2 = (22 + 14 * R()) * k; glowAt(g, x, y - h2 / 2, 26 * k, c.replace(')', ',0.35)').replace('rgb(', 'rgba(')); g.fillStyle = c; g.beginPath(); g.moveTo(x - 4 * k, y - h2); g.lineTo(x + 4 * k, y - h2); g.lineTo(x + 12 * k, y); g.lineTo(x - 12 * k, y); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - 3 * k, y - h2 - 5 * k, 6 * k, 5 * k); } } }
    else if (p.mode === 'fire') { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = k; for (let y = 0, r = 0; y < gy; y += 22 * k, r++) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); for (let x = (r % 2) * 25 * k; x < W; x += 50 * k) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 22 * k); g.stroke(); } } glowAt(g, W / 2, H, H * 0.8, 'rgba(255,120,30,0.4)'); for (const fx of [0.2, 0.8]) { glowAt(g, W * fx, H * 0.25, 50 * k, 'rgba(255,200,90,0.6)'); g.fillStyle = '#ffd070'; rr(g, W * fx - 9 * k, H * 0.25 - 14 * k, 18 * k, 28 * k, 5 * k); g.fill(); }
      g.fillStyle = '#d8302a'; g.fillRect(0, H * 0.46, W, 10 * k); g.fillStyle = '#ffd24a'; g.fillRect(0, H * 0.46 + 10 * k, W, 3 * k); }
    else { g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(R() * W, R() * gy, (20 + 30 * R()) * k, (10 + 18 * R()) * k, 0, 0, TAU); g.fill(); }
      for (let i = 0; i < 9; i++) { const x = (i + R()) * W / 8.5, h2 = (30 + 70 * R()) * k; g.fillStyle = p.rock; g.beginPath(); g.moveTo(x - 14 * k, 0); g.lineTo(x + 14 * k, 0); g.lineTo(x, h2); g.fill(); }
      for (let i = 0; i < 12; i++) { const x = (i + R()) * W / 11.5, y = gy + 2 * k, c = p.glow[i % p.glow.length], h2 = (24 + 44 * R()) * k; glowAt(g, x, y - h2 / 2, h2 * 1.1, c.replace(')', ',0.4)').replace('rgb(', 'rgba(')); g.fillStyle = c; g.beginPath(); g.moveTo(x - 9 * k, y); g.lineTo(x - 5 * k, y - h2 * 0.8); g.lineTo(x, y - h2); g.lineTo(x + 6 * k, y - h2 * 0.7); g.lineTo(x + 10 * k, y); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(x - 5 * k, y); g.lineTo(x - 3 * k, y - h2 * 0.75); g.lineTo(x, y - h2); g.lineTo(x, y); g.fill(); } }
    g.fillStyle = vg(g, gy, H, p.ground); g.fillRect(0, gy, W, H - gy);
  },
};

const cache = {};
// the scene for this skin, painted once per size (gy: where the ground line sits; default 78% down)
export function themeBack(ctx, skin, W, H, gy) {
  if (!skin || !skin.pack) return false;
  const DPR = ctx.getTransform().a || 1;
  gy = Math.round(gy || H * 0.78);
  const key = skin.id + '|' + W + 'x' + H + '|' + gy + '|' + Math.min(DPR, 1.5);
  let c = cache[key];
  if (!c) {
    const keys = Object.keys(cache); if (keys.length > 5) delete cache[keys[0]];
    const sc = Math.min(DPR, 1.5), k = Math.max(0.78, Math.min(1.5, Math.min(W, H) / 420));
    c = cache[key] = mk(W * sc, H * sc, (g) => { g.scale(sc, sc); BG[skin.pack.bg](g, W, H, gy, skin.pal, k); });
  }
  ctx.drawImage(c, 0, 0, W, H);
  return true;
}
// over a screen that keeps the game behind it (map, pause, intro, win, fail): a colour wash and a soft edge, no scene
export function themeWash(ctx, skin, W, H) {
  if (!skin || !skin.pack) return;
  const key = 'wash|' + skin.id + '|' + W + 'x' + H;
  let c = cache[key];
  if (!c) {
    const keys = Object.keys(cache); if (keys.length > 5) delete cache[keys[0]];
    c = cache[key] = mk(W / 3, H / 3, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.55); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, skin.pal.wash); g.fillStyle = r; g.fillRect(0, 0, w, h); g.fillStyle = skin.pal.tint; g.fillRect(0, 0, w, h); });
  }
  ctx.drawImage(c, 0, 0, W, H);
}

// ---- corner ornaments (small sprites, mirrored into the four corners)
const ORN = {
  holly: (g, s) => { g.translate(s * 0.3, s * 0.3); for (const a of [0.2, 0.9, 1.45]) { g.save(); g.rotate(a); g.fillStyle = '#2a8a3a'; g.strokeStyle = '#124a1c'; g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(0, 0); for (let i = 0; i <= 4; i++) { g.quadraticCurveTo(s * (0.07 + i * 0.07), s * (i % 2 ? 0.0 : -0.1), s * (0.1 + i * 0.07 + 0.05), -s * 0.01); } g.quadraticCurveTo(s * 0.2, s * 0.1, 0, 0); g.fill(); g.stroke(); g.restore(); } for (const [x, y] of [[0, 0], [s * 0.09, s * 0.04], [s * 0.03, s * 0.1]]) { g.fillStyle = '#d8302a'; g.strokeStyle = '#6a1008'; g.beginPath(); g.arc(x, y, s * 0.06, 0, TAU); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x - s * 0.02, y - s * 0.02, s * 0.015, 0, TAU); g.fill(); } },
  stitch: (g, s) => { g.translate(s * 0.15, s * 0.15); g.fillStyle = '#d8302a'; g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 0.5, 0); g.lineTo(0, s * 0.5); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = s * 0.025; g.setLineDash([s * 0.05, s * 0.04]); g.beginPath(); g.moveTo(s * 0.04, s * 0.38); g.lineTo(s * 0.38, s * 0.04); g.stroke(); g.setLineDash([]); g.fillStyle = '#fff4e4'; g.beginPath(); g.arc(s * 0.12, s * 0.12, s * 0.07, 0, TAU); g.fill(); g.fillStyle = '#e8a8a0'; g.beginPath(); g.arc(s * 0.12, s * 0.12, s * 0.035, 0, TAU); g.fill(); },
  filigree: (g, s) => { g.translate(s * 0.12, s * 0.12); g.strokeStyle = '#ffd24a'; g.lineCap = 'round'; g.lineWidth = s * 0.05; g.beginPath(); g.moveTo(0, s * 0.5); g.quadraticCurveTo(0, 0, s * 0.5, 0); g.stroke(); g.lineWidth = s * 0.035; g.beginPath(); g.moveTo(s * 0.06, s * 0.3); g.bezierCurveTo(s * 0.06, s * 0.1, s * 0.3, s * 0.06, s * 0.3, s * 0.06); g.stroke(); g.beginPath(); g.arc(s * 0.16, s * 0.16, s * 0.07, 0, TAU); g.stroke(); g.fillStyle = '#ffe9a0'; g.beginPath(); g.moveTo(s * 0.0, s * 0.0); g.lineTo(s * 0.09, s * 0.0); g.lineTo(s * 0.0, s * 0.09); g.fill(); g.fillStyle = '#c83a5a'; g.beginPath(); g.arc(s * 0.16, s * 0.16, s * 0.035, 0, TAU); g.fill(); },
  leaf: (g, s) => { g.translate(s * 0.25, s * 0.25); for (const [a, c] of [[0.1, '#5aa83a'], [0.8, '#3f8a2a'], [1.4, '#8ac84a']]) { g.save(); g.rotate(a); g.fillStyle = c; g.strokeStyle = '#1e4a10'; g.lineWidth = s * 0.025; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 0.2, -s * 0.16, s * 0.4, 0); g.quadraticCurveTo(s * 0.2, s * 0.16, 0, 0); g.fill(); g.stroke(); g.restore(); } g.fillStyle = '#a8662a'; g.strokeStyle = '#5a3210'; g.beginPath(); g.ellipse(s * 0.02, s * 0.02, s * 0.06, s * 0.08, 0.6, 0, TAU); g.fill(); g.stroke(); },
  rope: (g, s) => { g.translate(s * 0.15, s * 0.15); g.strokeStyle = '#6a4a20'; g.lineCap = 'round'; g.lineWidth = s * 0.09; g.beginPath(); g.arc(s * 0.22, s * 0.22, s * 0.16, Math.PI, Math.PI * 1.5); g.moveTo(s * 0.06, s * 0.22); g.lineTo(s * 0.06, s * 0.5); g.moveTo(s * 0.22, s * 0.06); g.lineTo(s * 0.5, s * 0.06); g.stroke(); g.strokeStyle = '#e8d4a0'; g.lineWidth = s * 0.055; g.beginPath(); g.arc(s * 0.22, s * 0.22, s * 0.16, Math.PI, Math.PI * 1.5); g.moveTo(s * 0.06, s * 0.22); g.lineTo(s * 0.06, s * 0.5); g.moveTo(s * 0.22, s * 0.06); g.lineTo(s * 0.5, s * 0.06); g.stroke(); g.fillStyle = '#ffd24a'; g.strokeStyle = '#8a5a10'; g.lineWidth = s * 0.03; g.beginPath(); g.arc(s * 0.1, s * 0.1, s * 0.07, 0, TAU); g.fill(); g.stroke(); },
  rivet: (g, s) => { g.translate(s * 0.14, s * 0.14); g.fillStyle = '#6a6488'; g.strokeStyle = '#2a2640'; g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 0.4, 0); g.lineTo(s * 0.4, s * 0.1); g.lineTo(s * 0.1, s * 0.1); g.lineTo(s * 0.1, s * 0.4); g.lineTo(0, s * 0.4); g.closePath(); g.fill(); g.stroke(); for (const [x, y] of [[0.05, 0.05], [0.28, 0.05], [0.05, 0.28]]) { g.fillStyle = '#c8c4e8'; g.beginPath(); g.arc(s * x, s * y, s * 0.025, 0, TAU); g.fill(); } },
};
const ornSprites = {};
const ornament = (kind, s) => { const key = kind + (s | 0); return ornSprites[key] || (ornSprites[key] = mk(s, s, (g) => { g.lineJoin = 'round'; ORN[kind](g, s); })); };
// a card's themed frame: a two-colour dashed border on the wood and ornaments in the corners
export function themeFrame(ctx, skin, x, y, w, h, r, s) {
  const F = skin && skin.pack; if (!F) return;
  ctx.save();
  ctx.lineWidth = 3 * s; ctx.strokeStyle = F.border[0]; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x + 5 * s, y + 5 * s, w - 10 * s, h - 10 * s, Math.max(2, r - 5 * s)) : ctx.rect(x + 5 * s, y + 5 * s, w - 10 * s, h - 10 * s); ctx.stroke();
  ctx.strokeStyle = F.border[1]; ctx.setLineDash([7 * s, 7 * s]); ctx.stroke(); ctx.setLineDash([]); // candy-cane / stitched / rope stripes
  const o = ornament(F.frame, Math.min(96, Math.round(60 * s * 1.5))), os = 56 * s;
  ctx.drawImage(o, x - 12 * s, y - 12 * s, os, os);
  ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(o, -12 * s, -12 * s, os, os); ctx.restore();
  ctx.save(); ctx.translate(x, y + h); ctx.scale(1, -1); ctx.drawImage(o, -12 * s, -12 * s, os, os); ctx.restore();
  ctx.save(); ctx.translate(x + w, y + h); ctx.scale(-1, -1); ctx.drawImage(o, -12 * s, -12 * s, os, os); ctx.restore();
  ctx.restore();
}

// ---- buttons: a material. (x, y, w, h) is the drawn face. big: the primary button
let bowSpr = null;
export function themeButton(ctx, skin, x, y, w, h, rad, u, big) {
  const B = skin && skin.pack && skin.pack.button; if (!B) return;
  ctx.save();
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, rad) : ctx.rect(x, y, w, h); ctx.clip();
  if (B === 'present') { // wrapped present: gold ribbon bands at both ends, clear of the label
    if (w > 120 * u) { ctx.fillStyle = 'rgba(255,214,74,0.95)'; ctx.fillRect(x + 7 * u, y, 5 * u, h); ctx.fillRect(x + w - 12 * u, y, 5 * u, h); ctx.fillStyle = 'rgba(120,70,0,0.35)'; ctx.fillRect(x + 12 * u, y, 1.2 * u, h); ctx.fillRect(x + w - 12 * u - 1.2 * u, y, 1.2 * u, h); }
  } else if (B === 'stitch') { // a seam of stitches along the edge
    ctx.strokeStyle = 'rgba(255,244,220,0.7)'; ctx.lineWidth = 1.5 * u; ctx.setLineDash([4 * u, 3 * u]); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x + 5 * u, y + 5 * u, w - 10 * u, h - 10 * u, Math.max(2, rad - 5 * u)) : ctx.rect(x + 5 * u, y + 5 * u, w - 10 * u, h - 10 * u); ctx.stroke(); ctx.setLineDash([]);
  } else if (B === 'studs') { // metal studs on the ends
    if (w > 70 * u) for (const sx of [x + 7 * u, x + w - 7 * u]) { ctx.fillStyle = skin.pack.stud || '#ffe9a0'; ctx.beginPath(); ctx.arc(sx, y + h / 2, 2.6 * u, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(sx + 0.6 * u, y + h / 2 + 0.8 * u, 1.4 * u, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
  if (B === 'present' && big && w > 140 * u && h > 40 * u) { // the bow on the big button
    if (!bowSpr) bowSpr = mk(72, 44, (g) => { g.lineJoin = 'round'; g.strokeStyle = '#8a5a08'; g.lineWidth = 2.5; g.fillStyle = '#ffd24a'; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(36, 30); g.quadraticCurveTo(36 + d * 30, -6, 36 + d * 28, 26); g.quadraticCurveTo(36 + d * 16, 30, 36, 30); g.fill(); g.stroke(); } g.fillStyle = '#ffb81a'; g.beginPath(); g.arc(36, 28, 7, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#ffd24a'; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(36, 32); g.lineTo(36 + d * 13, 44); g.lineTo(36 + d * 6, 28); g.fill(); g.stroke(); } });
    ctx.drawImage(bowSpr, x + w / 2 - 29 * u, y - 20 * u, 58 * u, 35.5 * u);
  }
}

// ---- icon shapes for the pause bars and the levels grid
const SH = {
  bauble: { bar: (g, x, y, w, h) => { rr(g, x - w * 0.05, y, w * 1.1, h, w * 0.55); g.fill(); }, cell: (g, x, y, r) => { g.beginPath(); g.arc(x, y + r * 0.1, r * 0.9, 0, TAU); g.fill(); g.fillRect(x - r * 0.25, y - r * 1.05, r * 0.5, r * 0.3); } },
  mug: { bar: (g, x, y, w, h) => { rr(g, x - w * 0.1, y + h * 0.1, w * 1.2, h * 0.9, w * 0.3); g.fill(); }, cell: (g, x, y, r) => { rr(g, x - r * 0.8, y - r * 0.7, r * 1.4, r * 1.5, r * 0.3); g.fill(); g.lineWidth = r * 0.3; g.beginPath(); g.arc(x + r * 0.6, y, r * 0.4, -1.3, 1.3); g.stroke(); } },
  gem: { bar: (g, x, y, w, h) => { g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w * 1.1, y + h * 0.3); g.lineTo(x + w * 1.1, y + h * 0.85); g.lineTo(x + w / 2, y + h); g.lineTo(x - w * 0.1, y + h * 0.85); g.lineTo(x - w * 0.1, y + h * 0.3); g.fill(); }, cell: (g, x, y, r) => { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.9, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.9, y); g.fill(); } },
  leaf: { bar: (g, x, y, w, h) => { g.beginPath(); g.moveTo(x + w / 2, y); g.quadraticCurveTo(x + w * 1.6, y + h * 0.5, x + w / 2, y + h); g.quadraticCurveTo(x - w * 0.6, y + h * 0.5, x + w / 2, y); g.fill(); }, cell: (g, x, y, r) => { g.beginPath(); g.moveTo(x - r, y + r * 0.6); g.quadraticCurveTo(x - r * 0.4, y - r * 1.1, x + r, y - r * 0.6); g.quadraticCurveTo(x + r * 0.5, y + r, x - r, y + r * 0.6); g.fill(); } },
  bubble: { bar: (g, x, y, w, h) => { g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w * 0.85, h / 2, 0, 0, TAU); g.fill(); }, cell: (g, x, y, r) => { g.beginPath(); g.arc(x, y, r * 0.95, 0, TAU); g.fill(); } },
};
// draws a pack's pause bar / grid cell in the current fill; returns false when the pack keeps the plain icon
export function themeShape(skin, what) { const I = skin && skin.pack && SH[skin.pack.icon]; return I ? I[what] : null; }

// ---- the title letters: dressed per pack. Called inside each letter's transform (centre 0,0; size = font px)
export function logoDress(skin, ctx, ch, i, size, n) {
  const L = skin && skin.pack && skin.pack.logo; if (!L) return;
  const s = size;
  if (L === 'santa') {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(90,130,180,0.55)'; ctx.lineWidth = s * 0.02; // snow settled on the top of each letter
    ctx.beginPath(); ctx.moveTo(-s * 0.26, -s * 0.3); ctx.quadraticCurveTo(-s * 0.16, -s * 0.46, -s * 0.04, -s * 0.38); ctx.quadraticCurveTo(s * 0.08, -s * 0.5, s * 0.2, -s * 0.36); ctx.quadraticCurveTo(s * 0.26, -s * 0.32, s * 0.24, -s * 0.28); ctx.quadraticCurveTo(s * 0.1, -s * 0.33, 0, -s * 0.27); ctx.quadraticCurveTo(-s * 0.14, -s * 0.34, -s * 0.26, -s * 0.3); ctx.fill(); ctx.stroke();
    if (i === 0) { // a Santa hat on the E
      ctx.save(); ctx.translate(-s * 0.02, -s * 0.36); ctx.rotate(-0.28); ctx.fillStyle = '#d8302a'; ctx.strokeStyle = '#6a1008'; ctx.lineWidth = s * 0.03; ctx.beginPath(); ctx.moveTo(-s * 0.3, 0); ctx.quadraticCurveTo(-s * 0.25, -s * 0.5, s * 0.1, -s * 0.52); ctx.quadraticCurveTo(s * 0.3, -s * 0.5, s * 0.46, -s * 0.28); ctx.quadraticCurveTo(s * 0.2, -s * 0.34, s * 0.3, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; rr(ctx, -s * 0.36, -s * 0.07, s * 0.74, s * 0.14, s * 0.07); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(s * 0.46, -s * 0.28, s * 0.09, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  } else if (L === 'beanie' && i === 0) { // a bobble beanie on the E
    ctx.save(); ctx.translate(-s * 0.02, -s * 0.36); ctx.rotate(-0.2); ctx.fillStyle = '#a8402a'; ctx.strokeStyle = '#4a1208'; ctx.lineWidth = s * 0.03; ctx.beginPath(); ctx.moveTo(-s * 0.28, 0); ctx.quadraticCurveTo(-s * 0.26, -s * 0.36, s * 0.04, -s * 0.38); ctx.quadraticCurveTo(s * 0.3, -s * 0.36, s * 0.3, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#f4e4c8'; rr(ctx, -s * 0.31, -s * 0.06, s * 0.64, s * 0.13, s * 0.06); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.02, -s * 0.42, s * 0.08, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
  } else if (L === 'crown' && (i === 0 || i === n - 1)) { // a crown on the first and last letter
    ctx.save(); ctx.translate(0, -s * 0.38); ctx.rotate(i ? 0.2 : -0.2); ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = '#8a5a08'; ctx.lineWidth = s * 0.03; ctx.beginPath(); ctx.moveTo(-s * 0.22, 0); ctx.lineTo(-s * 0.24, -s * 0.26); ctx.lineTo(-s * 0.11, -s * 0.12); ctx.lineTo(0, -s * 0.3); ctx.lineTo(s * 0.11, -s * 0.12); ctx.lineTo(s * 0.24, -s * 0.26); ctx.lineTo(s * 0.22, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#d8302a'; ctx.beginPath(); ctx.arc(0, -s * 0.07, s * 0.045, 0, TAU); ctx.fill(); ctx.restore();
  } else if (L === 'leaf' && i % 3 === 1) { ctx.save(); ctx.translate(s * 0.22, -s * 0.34); ctx.rotate(0.6); ctx.fillStyle = '#5aa83a'; ctx.strokeStyle = '#1e4a10'; ctx.lineWidth = s * 0.025; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.12, -s * 0.12, s * 0.26, 0); ctx.quadraticCurveTo(s * 0.12, s * 0.1, 0, 0); ctx.fill(); ctx.stroke(); ctx.restore();
  } else if (L === 'bubble' && i % 2 === 0) { ctx.strokeStyle = 'rgba(235,250,255,0.9)'; ctx.fillStyle = 'rgba(200,240,255,0.25)'; ctx.lineWidth = s * 0.03; ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.38 - (i % 4) * s * 0.03, s * (0.06 + 0.02 * (i % 3)), 0, TAU); ctx.fill(); ctx.stroke();
  } else if (L === 'gems' && i % 2 === 1) { ctx.fillStyle = '#e8ccff'; ctx.beginPath(); ctx.moveTo(s * 0.2, -s * 0.5); ctx.lineTo(s * 0.26, -s * 0.4); ctx.lineTo(s * 0.2, -s * 0.3); ctx.lineTo(s * 0.14, -s * 0.4); ctx.fill(); }
}
