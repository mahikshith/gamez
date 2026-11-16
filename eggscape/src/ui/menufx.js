// Skin ambient effect for the menus (2026-11-16): the hen outfit that is worn gives every menu screen a living layer
// (snow, marshmallows, glitter, leaves, embers ...), named by the `fx` field of its row in data/skin-ui.js.
// Cheap on purpose (phones lagged): ONE pooled particle system (max 48 particles, no allocation per frame), every
// particle is a drawImage of a small cached sprite (no gradients or shadowBlur while drawing), nothing at all with
// Battery saver, and a few still particles with reduced motion (calm). back() runs behind the panels; front() runs
// after the whole screen is drawn and adds what must sit ON the UI: snow piles on button tops, a light sweep on gold.

const TAU = Math.PI * 2, MAXP = 48;
const mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); return c; };
const glow = (col, mid) => mk(48, 48, (g) => { const r = g.createRadialGradient(24, 24, 0, 24, 24, 24); r.addColorStop(0, col); r.addColorStop(mid || 0.35, col); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 48, 48); });
const star4 = (col, halo) => mk(48, 48, (g) => { // a four-point twinkle with a soft halo
  const r = g.createRadialGradient(24, 24, 0, 24, 24, 20); r.addColorStop(0, halo); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 48, 48);
  g.fillStyle = col; g.beginPath(); g.moveTo(24, 2); g.quadraticCurveTo(24, 24, 46, 24); g.quadraticCurveTo(24, 24, 24, 46); g.quadraticCurveTo(24, 24, 2, 24); g.quadraticCurveTo(24, 24, 24, 2); g.fill();
});
const flake = () => mk(48, 48, (g) => { // six arms with little branches
  g.translate(24, 24); g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineWidth = 3;
  for (let i = 0; i < 6; i++) { g.save(); g.rotate((i * TAU) / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -20); g.moveTo(0, -12); g.lineTo(-6, -17); g.moveTo(0, -12); g.lineTo(6, -17); g.stroke(); g.restore(); }
});
const leaf = (a, b) => mk(48, 48, (g) => { g.translate(24, 24); g.rotate(-0.6); g.fillStyle = a; g.beginPath(); g.moveTo(-20, 0); g.quadraticCurveTo(0, -20, 20, 0); g.quadraticCurveTo(0, 20, -20, 0); g.fill(); g.strokeStyle = b; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-20, 0); g.lineTo(16, 0); g.stroke(); });
const petal = (a, b) => mk(48, 48, (g) => { const r = g.createLinearGradient(8, 8, 40, 40); r.addColorStop(0, a); r.addColorStop(1, b); g.fillStyle = r; g.translate(24, 24); g.rotate(0.7); g.beginPath(); g.moveTo(-16, 0); g.quadraticCurveTo(-4, -18, 16, -2); g.quadraticCurveTo(4, 16, -16, 0); g.fill(); });
const marsh = () => mk(48, 48, (g) => { g.fillStyle = '#fff6ea'; g.strokeStyle = '#e6c8aa'; g.lineWidth = 3; g.beginPath(); g.roundRect ? g.roundRect(8, 10, 32, 28, 9) : g.rect(8, 10, 32, 28); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,170,170,0.35)'; g.fillRect(12, 28, 24, 6); });
const coin = () => mk(48, 48, (g) => { g.fillStyle = '#ffd24a'; g.strokeStyle = '#b8801a'; g.lineWidth = 3; g.beginPath(); g.arc(24, 24, 18, 0, TAU); g.fill(); g.stroke(); g.strokeStyle = '#e8a82a'; g.lineWidth = 2.5; g.beginPath(); g.arc(24, 24, 11, 0, TAU); g.stroke(); });
const bubble = () => mk(48, 48, (g) => { g.fillStyle = 'rgba(200,240,255,0.18)'; g.strokeStyle = 'rgba(235,250,255,0.85)'; g.lineWidth = 2.5; g.beginPath(); g.arc(24, 24, 18, 0, TAU); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(17, 16, 4, 0, TAU); g.fill(); });
const rain = () => mk(16, 48, (g) => { const r = g.createLinearGradient(0, 0, 0, 48); r.addColorStop(0, 'rgba(210,230,255,0)'); r.addColorStop(1, 'rgba(210,230,255,0.95)'); g.strokeStyle = r; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(8, 2); g.lineTo(8, 46); g.stroke(); });

// per effect: n particles; sprites; v = fall speed (u/s, negative rises); vx drift; sway amplitude; spin (rad/s); sz size range (u);
// a alpha range; tw = twinkle in place (life seconds); flip = coin-like squash; rot = fixed tilt (rain)
const FX = {
  snow: { n: 44, spr: () => [glow('#fff', 0.5), flake(), glow('#fff', 0.25), flake()], v: [26, 62], vx: [-4, 4], sway: 16, spin: 1.6, sz: [9, 24], a: [0.6, 1], top: 1 },
  marsh: { n: 18, spr: () => [marsh(), marsh(), glow('#fff', 0.15)], v: [-34, 30], vx: [-5, 5], sway: 10, spin: 0.9, sz: [16, 28], a: [0.75, 1], mix: 1 },
  glitter: { n: 26, spr: () => [star4('#fff6c0', 'rgba(255,215,90,0.55)'), star4('#fff', 'rgba(255,230,140,0.5)')], v: [-3, 3], vx: [-3, 3], sway: 0, spin: 0.3, sz: [12, 28], a: [0.7, 1], tw: [1.4, 3] },
  crystal: { n: 24, spr: () => [star4('#e8ccff', 'rgba(170,120,255,0.55)'), star4('#bff4ff', 'rgba(90,210,255,0.5)')], v: [-3, 3], vx: [-3, 3], sway: 0, spin: 0.3, sz: [12, 26], a: [0.7, 1], tw: [1.4, 3] },
  sparks: { n: 24, spr: () => [star4('#d8fff0', 'rgba(70,230,170,0.5)'), star4('#d0f0ff', 'rgba(80,190,255,0.5)')], v: [-14, -4], vx: [-4, 4], sway: 6, spin: 0.5, sz: [10, 22], a: [0.6, 1], tw: [1.6, 3.2] },
  leaves: { n: 24, spr: () => [leaf('#e8872a', '#9a4a10'), leaf('#c8402a', '#7a1e10'), leaf('#d8b02a', '#8a6a10'), leaf('#6aa83a', '#3a6a1a')], v: [22, 48], vx: [-10, 10], sway: 26, spin: 2.2, sz: [14, 26], a: [0.8, 1] },
  petals: { n: 26, spr: () => [petal('#fff0f4', '#ffb0c8'), petal('#ffffff', '#ffd0dc'), petal('#fff4c0', '#ffc860')], v: [20, 42], vx: [-8, 8], sway: 22, spin: 2, sz: [12, 22], a: [0.8, 1] },
  embers: { n: 30, spr: () => [glow('#ff9a2a', 0.2), glow('#ffd24a', 0.2), glow('#ff5a1a', 0.2)], v: [-70, -22], vx: [-6, 6], sway: 14, spin: 0, sz: [8, 18], a: [0.6, 1], fade: 1 },
  rain: { n: 40, spr: () => [rain()], v: [190, 300], vx: [-38, -38], sway: 0, spin: 0, sz: [9, 15], a: [0.3, 0.55], rot: 0.19, stretch: 2.2 },
  coins: { n: 14, spr: () => [coin()], v: [30, 58], vx: [-6, 6], sway: 14, spin: 0.8, sz: [14, 22], a: [0.85, 1], flip: 1 },
  bubbles: { n: 28, spr: () => [bubble()], v: [-60, -22], vx: [-4, 4], sway: 14, spin: 0, sz: [8, 26], a: [0.6, 0.95] },
  fireflies: { n: 22, spr: () => [glow('#e8ff6a', 0.2), glow('#ffe86a', 0.2)], v: [-6, 6], vx: [-8, 8], sway: 12, spin: 0, sz: [12, 24], a: [0.7, 1], tw: [2, 4.5] },
};

const P = []; // the pool, built once
for (let i = 0; i < MAXP; i++) P.push({ x: 0, y: 0, vx: 0, vy: 0, s: 1, r: 0, vr: 0, ph: 0, a: 1, spr: 0, age: 0, life: 1 });
const rnd = (a, b) => a + Math.random() * (b - a);
const S = { id: null, cfg: null, spr: null, n: 0, W: 0, H: 0, t: 0, calmed: null, piles: [], pileT: 0, sweep: { t: -9, id: null, k: 0 }, ms: 0, frames: 0, sweepSpr: null };

function respawn(p, c, u, fresh) {
  const W = S.W, H = S.H, tw = !!c.tw;
  p.s = rnd(c.sz[0], c.sz[1]) * u; p.a = rnd(c.a[0], c.a[1]); p.spr = (Math.random() * S.spr.length) | 0;
  p.vy = rnd(c.v[0], c.v[1]) * u; p.vx = rnd(c.vx[0], c.vx[1]) * u; p.vr = (Math.random() - 0.5) * 2 * c.spin; p.ph = Math.random() * TAU; p.r = c.rot !== undefined ? c.rot : Math.random() * TAU;
  if (c.mix) { if (p.spr === 2) { p.vy = -Math.abs(p.vy); p.s *= 1.6; p.a *= 0.35; p.vr = 0; } else p.vy = Math.abs(p.vy); } // marshmallows sink, steam rises
  if (tw) { p.x = Math.random() * W; p.y = Math.random() * H; p.life = rnd(tw[0], tw[1]); p.age = fresh ? Math.random() * p.life : 0; return; }
  p.x = Math.random() * W; p.y = fresh ? Math.random() * H : p.vy >= 0 ? -p.s * 2 : H + p.s * 2; p.age = 0; p.life = 1;
}

function setup(id, cfgId, W, H, u, calm) {
  S.id = id; S.cfg = FX[cfgId]; S.spr = S.cfg.spr(); S.W = W; S.H = H; S.calmed = calm;
  S.n = Math.min(MAXP, calm ? 8 : Math.round(S.cfg.n * Math.min(1.3, (W * H) / (412 * 915 * 0.9)) )); // a bigger screen gets a few more
  if (calm) S.n = Math.min(S.n, 8);
  for (let i = 0; i < S.n; i++) respawn(P[i], S.cfg, u, true);
  S.piles.length = 0;
}

// behind the panels. skin: ui.skin; t: seconds (game clock)
export function menuFxBack(ctx, skin, save, W, H, u, DPR, t) {
  if (!skin || !skin.fx || !FX[skin.fx] || save.saver) { S.id = null; return; }
  const t0 = performance.now(), calm = !!save.calm;
  if (S.id !== skin.fx || S.W !== W || S.H !== H || S.calmed !== calm) setup(skin.fx, skin.fx, W, H, u, calm);
  const dt = S.t ? Math.min(0.05, Math.max(0, t - S.t)) : 0.016; S.t = t;
  const c = S.cfg, spr = S.spr;
  for (let i = 0; i < S.n; i++) {
    const p = P[i];
    if (!calm) {
      p.ph += dt * 1.3;
      p.r += p.vr * dt; p.y += p.vy * dt;
      p.x += (p.vx + (c.sway ? Math.sin(p.ph) * c.sway * u : 0)) * dt;
      if (c.tw) { if ((p.age += dt) > p.life) respawn(p, c, u, false); }
      else if (p.y > H + p.s * 3 || p.y < -p.s * 3 || p.x < -p.s * 4 || p.x > W + p.s * 4) respawn(p, c, u, false);
    }
    let a = p.a;
    if (c.tw) a *= calm ? 0.6 : Math.sin(Math.PI * p.age / p.life);
    else if (c.fade) a *= Math.max(0, Math.min(1, p.y / (H * 0.35))); // embers die out as they rise
    else if (c.top && !calm) a *= Math.min(1, (p.y + p.s) / (H * 0.08) + 0.0);
    if (a < 0.02) continue;
    const co = Math.cos(p.r), si = Math.sin(p.r), f = c.flip ? Math.cos(p.ph * 2.4) : 1, st = c.stretch || 1, d = p.s;
    ctx.globalAlpha = a;
    ctx.setTransform(DPR * co * f, DPR * si * f, -DPR * si, DPR * co, DPR * p.x, DPR * p.y);
    ctx.drawImage(spr[p.spr], -d / 2, -d / 2 * st, d, d * st);
  }
  ctx.globalAlpha = 1; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  S.ms += performance.now() - t0; S.frames++;
}

// after the whole screen: snow piles on button tops (they grow, sit a while, melt), a light sweep over gold buttons
export function menuFxFront(ctx, skin, save, buttons, H, u, t) {
  if (!skin || !skin.fx || save.saver || S.id !== skin.fx) return;
  const t0 = performance.now(), calm = !!save.calm;
  const usable = (b) => b.w > 60 * u && b.h > 26 * u && b.y > H * 0.1 && b.y + b.h < H * 0.98;
  if (skin.fx === 'snow') {
    const piles = S.piles;
    if (calm && !piles.length && buttons.length) { for (const b of buttons) if (usable(b) && piles.length < 3) piles.push({ id: b.id, k: rnd(0.2, 0.8), age: 1.2, life: 1e9 }); }
    if (!calm && t - S.pileT > 0.45 && piles.length < 7) {
      S.pileT = t;
      const b = buttons[(Math.random() * buttons.length) | 0];
      if (b && usable(b)) piles.push({ id: b.id, k: rnd(0.12, 0.88), age: 0, life: rnd(6, 10) });
    }
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(80,120,170,0.35)'; ctx.lineWidth = 1 * u;
    for (let i = piles.length - 1; i >= 0; i--) {
      const q = piles[i]; if (!calm) q.age += 1 / 60;
      const b = buttons.find((e) => e.id === q.id);
      if (!b || q.age > q.life) { piles.splice(i, 1); continue; }
      const grow = Math.min(1, q.age / 1.6), melt = Math.min(1, (q.life - q.age) / 2.2), k = grow * melt; // slow build-up, then it melts away
      if (k <= 0.03) continue;
      const x = b.x + 14 * u + (b.w - 28 * u) * q.k, y = b.y + 1.5 * u, w = 15 * u * k, h = 9 * u * k;
      ctx.beginPath(); ctx.moveTo(x - w, y); ctx.bezierCurveTo(x - w * 0.9, y - h * 1.1, x - w * 0.2, y - h * 1.35, x + w * 0.1, y - h * 1.1); ctx.bezierCurveTo(x + w * 0.5, y - h * 1.25, x + w * 0.95, y - h * 0.7, x + w, y); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
  } else if (skin.fx === 'glitter' && !calm) {
    const sw = S.sweep;
    if (t - sw.t > 3.2 && buttons.length) { const b = buttons[(Math.random() * buttons.length) | 0]; if (b && usable(b)) { sw.t = t; sw.id = b.id; } }
    const k = (t - sw.t) / 0.7, b = k >= 0 && k < 1 ? buttons.find((e) => e.id === sw.id) : null;
    if (b) { // a pale slanted band, clipped to the button
      if (!S.sweepSpr) S.sweepSpr = mk(64, 8, (g) => { const r = g.createLinearGradient(0, 0, 64, 0); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.5, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 8); });
      ctx.save(); ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip();
      const bw = b.h * 1.1, bx = b.x - bw + (b.w + 2 * bw) * k;
      ctx.transform(1, 0, -0.5, 1, 0, 0); // skew
      ctx.drawImage(S.sweepSpr, bx + b.y * 0.5, b.y, bw, b.h);
      ctx.restore();
    }
  }
  S.ms += performance.now() - t0;
}
export const menuFxStats = () => { const r = { ms: S.frames ? S.ms / S.frames : 0, frames: S.frames, n: S.n }; S.ms = 0; S.frames = 0; return r; };
