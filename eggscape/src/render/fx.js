// Particle VFX in world space (meters, y up). Cheap, pooled, capped.
// Every particle has FORM (no plain discs): soft two-tone puffs (cached sprites), tumbling faceted shards,
// four-point sparkles that pop and shrink, tapered streak sparks, teardrop drops, comic impact stars.
// Motion is eased: puffs bloom fast and settle, sparkles overshoot, shards fall under gravity and bounce once.
const MAX = 560;
const TAU = 6.283185307;
const easeOut = (u) => 1 - (1 - u) * (1 - u) * (1 - u);
const backOut = (u) => { const c = 1.9, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; };

// ---- soft puff sprites: one small offscreen canvas per colour (a lumpy cloud with a lit top-left and a shaded
// underside), so a puff costs one drawImage instead of a per-frame gradient
const PUFFS = new Map();
function puffSprite(color) {
  let cv = PUFFS.get(color);
  if (cv) return cv;
  if (PUFFS.size > 48) PUFFS.clear();
  const S = 64;
  cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(S, S) : Object.assign(document.createElement('canvas'), { width: S, height: S });
  const c = cv.getContext('2d');
  // the silhouette: four overlapping lobes with a firm but soft edge
  const lobe = (x, y, r) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.62, 'rgba(255,255,255,0.92)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  };
  lobe(32, 34, 21); lobe(21, 30, 15); lobe(43, 31, 16); lobe(31, 22, 15);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = color; c.fillRect(0, 0, S, S);
  // form: light from the top-left, a darker belly
  c.globalCompositeOperation = 'source-atop';
  let g = c.createRadialGradient(22, 20, 2, 26, 24, 26);
  g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  g = c.createLinearGradient(0, 30, 0, 58);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,10,0,0.3)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  PUFFS.set(color, cv);
  return cv;
}

// irregular shard outlines (unit size), picked per particle
const SHARDS = [
  [[-1, -0.35], [0.2, -0.75], [1, 0.1], [-0.25, 0.7]],
  [[-0.9, 0.5], [-0.3, -0.7], [0.95, -0.2], [0.4, 0.65]],
  [[-1, 0.1], [0.1, -0.6], [0.9, 0.55]],
  [[-0.8, -0.5], [0.9, -0.45], [0.55, 0.5], [-0.35, 0.7], [-1, 0.15]],
];

export class FX {
  constructor() {
    this.p = [];
    this.shake = 0; // camera trauma 0..1 (the shell squares it and feeds smooth noise); decays here
    this.flash = 0;
    this.flashColor = '#fff';
    this.punch = 0;
    this.rings = []; // shockwaves
  }

  add(o) {
    if (this.p.length >= MAX) this.p.shift();
    const q = { x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, life: 1, size: 0.05, grow: 0, color: '#fff', type: 'dot', rot: 0, vr: 0, alpha: 1, ...o };
    q.max = q.life;
    if (q.type === 'chip' || q.type === 'shard') { q.sh = SHARDS[(Math.random() * SHARDS.length) | 0]; q.tum = Math.random() * TAU; q.vt = 6 + Math.random() * 10; }
    this.p.push(q);
    return q;
  }

  burst(x, y, n, f) {
    for (let i = 0; i < n; i++) this.add(f(i, Math.random(), Math.random()));
  }

  // o: { sy: vertical squash (a ring lying on the floor), delay }
  wave(x, y, r, color, life = 0.45, width = 0.08, o = null) {
    this.rings.push({ x, y, r, color, life, max: life, width, sy: (o && o.sy) || 1, delay: (o && o.delay) || 0 });
  }

  // add camera trauma (never lowers it)
  kick(tr) { if (tr > this.shake) this.shake = Math.min(1, tr); }

  update(dt) {
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * (1.3 + 1.6 * this.shake)); // big hits fall off fast, the tail lingers a touch
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    if (this.punch > 0) this.punch = Math.max(0, this.punch - dt * 2.5);
    const p = this.p;
    let w = 0;
    for (let i = 0; i < p.length; i++) {
      const q = p[i];
      if (q.delay > 0) { q.delay -= dt; p[w++] = q; continue; }
      q.life -= dt;
      if (q.life <= 0) continue;
      q.vy -= q.g * dt;
      if (q.drag) { const k = Math.max(0, 1 - q.drag * dt); q.vx *= k; q.vy *= k; }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.vr * dt;
      if (q.tum !== undefined) q.tum += q.vt * dt;
      q.size += q.grow * dt;
      if (q.floor !== undefined && q.y < q.floor) {
        q.y = q.floor;
        if (q.type === 'drop') { q.type = 'splat'; q.vx = q.vy = q.g = 0; q.size *= 1.5; q.layer = 'back'; q.life = Math.min(q.life, 0.9); q.max = q.life; } // a drop lands as a little splat
        else if (q.vy < -0.8 && !q.hop) { q.hop = 1; q.vy *= -0.38; q.vx *= 0.6; q.vr *= 0.5; if (q.vt) q.vt *= 0.5; } // one small bounce
        else { q.vy = 0; q.vx *= 0.5; q.vr = 0; if (q.vt) q.vt = 0; }
      }
      p[w++] = q;
    }
    p.length = w;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      if (r.delay > 0) { r.delay -= dt; continue; }
      r.life -= dt;
      if (r.life <= 0) this.rings.splice(i, 1);
    }
  }

  // ctx is in world space (scale k, y flipped)
  draw(ctx, layer) {
    for (const q of this.p) {
      if ((q.layer || 'front') !== layer || q.delay > 0) continue;
      const t = q.life / q.max, u = 1 - t;
      const a = q.alpha * (q.fade === false ? 1 : Math.min(1, t * 2.2));
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = q.color;
      switch (q.type) {
        case 'dot':
          ctx.beginPath();
          ctx.arc(q.x, q.y, Math.max(0.005, q.size), 0, TAU);
          ctx.fill();
          break;
        case 'flame': {
          // teardrop flame tongue, hot core fades to color
          const s = Math.max(0.01, q.size * (0.6 + 0.4 * t));
          ctx.beginPath();
          ctx.moveTo(q.x, q.y + s * 1.9);
          ctx.quadraticCurveTo(q.x + s, q.y + s * 0.3, q.x, q.y - s);
          ctx.quadraticCurveTo(q.x - s, q.y + s * 0.3, q.x, q.y + s * 1.9);
          ctx.fillStyle = t > 0.6 ? q.hot || '#fff3b0' : q.color;
          ctx.fill();
          break;
        }
        case 'puff':
        case 'smoke': {
          // a soft lumpy puff: blooms fast (ease-out), thins as it fades
          const s = q.type === 'puff' ? q.size * (0.35 + 0.65 * easeOut(u)) : q.size;
          if (s <= 0.004) break;
          ctx.globalAlpha = a * (q.type === 'puff' ? Math.min(1, u * 9) : 1);
          const spr = puffSprite(q.color), d = s * 2.5, fl = q.flip ? -1 : 1;
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.scale(fl, -1); // sprites are y-down: keep the lit side up
          ctx.drawImage(spr, -d / 2, -d / 2, d, d);
          ctx.restore();
          break;
        }
        case 'spark': {
          // a tapered streak: bright head, thin tail along its motion
          const hx = q.x, hy = q.y, L = q.len || 0.035, tx = hx - q.vx * L, ty = hy - q.vy * L;
          const sp = Math.hypot(q.vx, q.vy) || 1, nx = (-q.vy / sp) * q.size * 0.6, ny = (q.vx / sp) * q.size * 0.6;
          ctx.beginPath();
          ctx.moveTo(hx + nx, hy + ny);
          ctx.lineTo(tx, ty);
          ctx.lineTo(hx - nx, hy - ny);
          ctx.arc(hx, hy, q.size * 0.6, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
          ctx.fill();
          break;
        }
        case 'star': {
          // four-point sparkle: pops in with a little overshoot, twinkles, shrinks away
          const pop = u < 0.18 ? backOut(u / 0.18) : 1 - Math.pow((u - 0.18) / 0.82, 1.6);
          const s = q.size * 1.25 * pop * (0.85 + 0.15 * Math.sin(q.rot * 3 + q.x * 9));
          if (s <= 0.004) break;
          ctx.globalAlpha = q.alpha;
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const an = q.rot + k * 0.7853982, r = k & 1 ? s * 0.2 : s * (k & 2 ? 0.72 : 1); // long and short arms
            ctx.lineTo(q.x + Math.cos(an) * r, q.y + Math.sin(an) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fff'; // hot centre
          ctx.beginPath();
          ctx.arc(q.x, q.y, s * 0.2, 0, TAU);
          ctx.fill();
          break;
        }
        case 'shard':
        case 'chip': {
          // a faceted shard tumbling in 3D: its width breathes with the flip, one facet catches the light
          const s = q.size * 1.35, P = q.sh, fl = Math.cos(q.tum);
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(q.rot);
          ctx.scale(s, s * (0.25 + 0.75 * Math.abs(fl)));
          ctx.beginPath();
          for (let k = 0; k < P.length; k++) ctx.lineTo(P[k][0], P[k][1]);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = fl > 0 ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.22)';
          ctx.beginPath();
          ctx.moveTo(P[0][0], P[0][1]); ctx.lineTo(P[1][0], P[1][1]); ctx.lineTo((P[1][0] + P[2][0]) / 2 * 0.4, (P[0][1] + P[2][1]) / 2 * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'drop': {
          // a teardrop along its motion, with a wet highlight
          const sp = Math.hypot(q.vx, q.vy) || 1, dx = q.vx / sp, dy = q.vy / sp, s = q.size, L = s * (1.2 + Math.min(1.6, sp * 0.22));
          ctx.beginPath();
          ctx.moveTo(q.x - dx * L, q.y - dy * L);
          ctx.quadraticCurveTo(q.x - dy * s * 1.1, q.y + dx * s * 1.1, q.x + dx * s, q.y + dy * s);
          ctx.quadraticCurveTo(q.x + dy * s * 1.1, q.y - dx * s * 1.1, q.x - dx * L, q.y - dy * L);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.beginPath();
          ctx.arc(q.x - s * 0.25, q.y + s * 0.3, s * 0.28, 0, TAU);
          ctx.fill();
          break;
        }
        case 'ray': {
          // comic impact star: snaps out, holds a beat, gone. A pale core inside a coloured burst.
          const n = q.n || 7, s = q.size * (0.45 + 0.55 * easeOut(Math.min(1, u * 2.4)));
          ctx.globalAlpha = q.alpha * Math.min(1, t * 3);
          for (let pass = 0; pass < 2; pass++) {
            const R = pass ? s * 0.62 : s;
            ctx.fillStyle = pass ? '#fff' : q.color;
            ctx.beginPath();
            for (let k = 0; k < n * 2; k++) {
              const an = q.rot + (k / (n * 2)) * TAU, r = k % 2 ? R * 0.42 : R * (k % 4 ? 0.8 : 1);
              ctx.lineTo(q.x + Math.cos(an) * r, q.y + Math.sin(an) * r);
            }
            ctx.closePath();
            ctx.fill();
          }
          break;
        }
        case 'splat': {
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, q.size * 1.6, q.size * 0.45, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.beginPath();
          ctx.ellipse(q.x - q.size * 0.5, q.y + q.size * 0.12, q.size * 0.5, q.size * 0.12, 0, 0, TAU);
          ctx.fill();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
    // shockwave rings: shoot out and slow (ease-out), a bright inner line inside a coloured band that thins away
    for (const w of this.rings) {
      if (w.delay > 0) continue;
      const t = 1 - w.life / w.max, r = w.r * (0.15 + 0.85 * easeOut(t)), lw = w.width * (1 - t) * (1 - t) + 0.008;
      ctx.globalAlpha = (1 - t) * 0.85;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      if (w.sy !== 1) ctx.ellipse(w.x, w.y, r, r * w.sy, 0, 0, TAU); else ctx.arc(w.x, w.y, r, 0, TAU);
      ctx.stroke();
      if (lw > 0.03) {
        ctx.globalAlpha = (1 - t) * 0.7;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = lw * 0.3;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- presets ----
  dust(x, y, n = 6, color = 'rgba(230,220,200,0.8)') {
    this.burst(x, y, n, (i, a, b) => ({ x, y, vx: (a - 0.5) * 2.6, vy: 0.2 + b * 1.1, drag: 4, life: 0.45 + b * 0.3, size: 0.09 + a * 0.07, color, type: 'puff', flip: i & 1 }));
  }
  // An egg lands: dust kicked out sideways along the surface (tangent), scaled by the hit; grit on a hard one.
  // (nx, ny) is the surface normal pointing back at the egg; power 0..1.
  land(x, y, nx, ny, power, color = 'rgba(236,226,204,0.85)', grit = '#e9dcc0') {
    const tx = -ny, ty = nx, n = 2 + Math.round(power * 6);
    for (let i = 0; i < n; i++) {
      const sd = i & 1 ? 1 : -1, a = Math.random(), b = Math.random(), sp = (1.2 + 2.6 * power) * (0.5 + a);
      this.add({ x: x + tx * sd * 0.05, y: y + ty * sd * 0.05, vx: tx * sd * sp + nx * (0.25 + b * 0.5), vy: ty * sd * sp + ny * (0.25 + b * 0.5), drag: 5.5, life: 0.32 + 0.3 * power + b * 0.15, size: 0.06 + 0.09 * power * (0.6 + a * 0.6), color, type: 'puff', flip: i & 1 });
    }
    if (power > 0.45) {
      const m = Math.round(2 + power * 5);
      for (let i = 0; i < m; i++) {
        const sd = i & 1 ? 1 : -1, a = Math.random(), b = Math.random(), sp = 1.5 + 3.5 * power * a;
        this.add({ x, y, vx: tx * sd * sp + nx * (1 + b * 2.2), vy: ty * sd * sp + ny * (1 + b * 2.2), g: 9, life: 0.35 + b * 0.3, size: 0.018 + a * 0.016, color: grit, type: 'chip', rot: a * 6, vr: (b - 0.5) * 24 });
      }
      this.wave(x, y, 0.3 + 0.35 * power, 'rgba(255,255,255,0.8)', 0.22, 0.05);
    }
  }
  yolk(x, y, floor) {
    this.burst(x, y, 16, (i, a, b) => ({ x, y, vx: (a - 0.5) * 5, vy: 1 + b * 3.5, g: 12, life: 0.9 + b * 0.5, size: 0.04 + a * 0.045, color: i % 3 ? '#ffc21a' : '#ffe9a8', type: 'drop', floor }));
    this.add({ x, y, life: 1.6, size: 0.25, color: 'rgba(255,190,30,0.85)', type: 'splat', layer: 'back', fade: true });
  }
  sparkle(x, y, n = 10, color = '#fff6c2') {
    this.burst(x, y, n, (i, a, b) => {
      const an = a * TAU, sp = 1 + b * 2.4;
      return { x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, drag: 2.5, g: 1.2, life: 0.55 + b * 0.45, size: 0.07 + a * 0.07, color, type: 'star', rot: a * 3, vr: 2 + b * 3, delay: i * 0.012 };
    });
  }
  flameAt(x, y, scale = 1, vx = 0, vy = 0) {
    const a = Math.random();
    this.add({ x: x + (a - 0.5) * 0.18 * scale, y, vx: vx * 0.6 + (Math.random() - 0.5) * 0.4, vy: vy * 0.6 + 1.1 + Math.random() * 0.9, drag: 1.5, life: 0.35 + Math.random() * 0.25, size: (0.07 + Math.random() * 0.06) * scale, grow: -0.08, color: a > 0.5 ? '#ff7a1a' : '#ff4d12', hot: '#ffe27a', type: 'flame' });
    if (Math.random() < 0.18) this.add({ x, y: y + 0.1, vx: (Math.random() - 0.5) * 0.8, vy: 1.6 + Math.random(), drag: 0.6, life: 0.8, size: 0.018, color: '#ffb347', type: 'dot' });
  }
  smoke(x, y, n = 4, color = 'rgba(60,55,60,0.55)') {
    this.burst(x, y, n, (i, a, b) => ({ x: x + (a - 0.5) * 0.3, y, vx: (a - 0.5) * 0.6, vy: 0.6 + b * 0.8, drag: 0.8, life: 1 + b * 0.6, size: 0.1 + a * 0.08, grow: 0.25, color, type: 'smoke', flip: i & 1 }));
  }
  explosion(x, y, R) {
    this.flash = 1;
    this.flashColor = '#fff2c4';
    this.shake = 1;
    this.wave(x, y, R * 1.3, '#fff3d0', 0.5, 0.25);
    this.add({ x, y, life: 0.2, size: R * 0.7, color: '#ffd23f', type: 'ray', n: 9, rot: Math.random() * 6 });
    this.burst(x, y, 26, (i, a, b) => {
      const an = a * TAU, sp = 2 + b * 6;
      return { x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, drag: 3.5, life: 0.35 + b * 0.35, size: 0.14 + a * 0.16, grow: -0.2, color: i % 2 ? '#ff8a1c' : '#ffd23f', hot: '#fff7c9', type: 'flame' };
    });
    this.burst(x, y, 12, (i, a, b) => ({ x, y, vx: (a - 0.5) * 3, vy: b * 2.5, drag: 1.2, life: 1.4 + b, size: 0.2 + a * 0.15, grow: 0.4, color: 'rgba(55,50,55,0.6)', type: 'smoke', flip: i & 1 }));
    this.burst(x, y, 18, (i, a, b) => {
      const an = a * TAU, sp = 4 + b * 7;
      return { x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: 6, life: 0.4 + b * 0.4, size: 0.03, color: '#ffe08a', type: 'spark' };
    });
  }
  chips(x, y, color, n = 8, speed = 2.5) {
    this.burst(x, y, n, (i, a, b) => ({ x, y, vx: (a - 0.5) * speed * 2, vy: b * speed, g: 9, life: 0.8 + b * 0.5, size: 0.03 + a * 0.04, color, type: 'chip', rot: a * 6, vr: (b - 0.5) * 20 }));
  }
  // comic hit star + a quick ring at the point of contact
  impact(x, y, size = 0.45, color = '#ffd76a') {
    this.add({ x, y, life: 0.16, size, color, type: 'ray', n: 6 + ((Math.random() * 3) | 0), rot: Math.random() * 6, fade: false });
    this.wave(x, y, size * 1.5, color, 0.26, 0.07);
  }
  // shell chips thrown off a crack, away from the surface (nx, ny); power 0..1
  shell(x, y, nx = 0, ny = 1, power = 0.5, n = 7, floor) {
    for (let i = 0; i < n; i++) {
      const a = Math.random(), b = Math.random(), sd = a - 0.5, sp = 1.6 + 2.6 * power * b;
      this.add({ x, y, vx: nx * sp + -ny * sd * 4.2, vy: ny * sp + nx * sd * 4.2 + 1.2, g: 10, life: 0.7 + b * 0.5, size: 0.028 + a * 0.03, color: i % 3 ? '#fbf3e2' : '#e6d5b4', type: 'chip', rot: a * 6, vr: (b - 0.5) * 26, floor });
    }
    this.land(x, y, nx, ny, 0.3 + 0.3 * power, 'rgba(255,250,238,0.8)');
  }
  // an egg comes home: straw kicked up out of the nest, a fan of sparkles, two pulses along the ground
  nestBurst(x, y, straw = '#d9b45a', floor) {
    this.wave(x, y - 0.05, 1.5, '#ffe9a0', 0.55, 0.12, { sy: 0.3 });
    this.wave(x, y - 0.05, 2.3, '#fff6d5', 0.7, 0.07, { sy: 0.3, delay: 0.09 });
    this.wave(x, y + 0.15, 0.75, '#ffffff', 0.3, 0.09);
    for (let i = 0; i < 12; i++) {
      const a = Math.random(), b = Math.random(), an = Math.PI * (0.12 + 0.76 * ((i + a) / 12)), sp = 2.2 + b * 2.6;
      this.add({ x: x + Math.cos(an) * 0.2, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp + 0.8, g: 9.5, drag: 0.6, life: 0.8 + b * 0.5, size: 0.05 + a * 0.035, color: i % 3 ? straw : '#f3dc9a', type: 'chip', rot: a * 6, vr: (b - 0.5) * 18, floor });
    }
    for (let i = 0; i < 14; i++) {
      const a = Math.random(), b = Math.random(), an = Math.PI * (0.05 + 0.9 * ((i + a) / 14)), sp = 1.6 + b * 3.2;
      this.add({ x, y: y + 0.1, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, drag: 2.2, g: -0.6, life: 0.6 + b * 0.55, size: 0.07 + a * 0.08, color: i % 2 ? '#fff6c2' : '#ffd94a', type: 'star', rot: a * 3, vr: 2 + b * 4, delay: 0.03 + i * 0.014 });
    }
    this.land(x, y - 0.08, 0, 1, 0.55, 'rgba(250,236,190,0.8)', straw);
  }
  // an orb is taken: a ring and a spray of streaks in the orb's own colour, a few motes that drift up
  orbBurst(x, y, color) {
    this.add({ x, y, life: 0.18, size: 0.5, color, type: 'ray', n: 8, rot: Math.random() * 6, fade: false });
    this.wave(x, y, 1.0, color, 0.4, 0.14);
    this.wave(x, y, 1.6, '#ffffff', 0.5, 0.05, { delay: 0.06 });
    for (let i = 0; i < 14; i++) {
      const an = (i / 14) * TAU + Math.random() * 0.3, sp = 3.5 + Math.random() * 3.5;
      this.add({ x: x + Math.cos(an) * 0.15, y: y + Math.sin(an) * 0.15, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, drag: 4.5, life: 0.3 + Math.random() * 0.25, size: 0.05, len: 0.05, color: i % 3 ? color : '#ffffff', type: 'spark' });
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.random(), b = Math.random(), an = a * TAU;
      this.add({ x: x + Math.cos(an) * 0.3, y: y + Math.sin(an) * 0.3, vx: Math.cos(an) * 0.8, vy: 0.8 + b * 1.4, drag: 1.5, life: 0.7 + b * 0.5, size: 0.06 + a * 0.06, color: i % 2 ? color : '#ffffff', type: 'star', rot: a * 3, vr: 3, delay: 0.05 + i * 0.03 });
    }
  }
  // a close shave: a few quick streaks past the thorn's tip, along the egg's path
  whoosh(x, y, dx, dy) {
    const L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    for (let i = 0; i < 4; i++) {
      const o = (i - 1.5) * 0.07;
      this.add({ x: x - uy * o - ux * 0.1, y: y + ux * o - uy * 0.1, vx: ux * (4.5 + i * 0.6), vy: uy * (4.5 + i * 0.6), drag: 6, life: 0.22 + i * 0.02, size: 0.035, len: 0.07, color: 'rgba(255,255,255,0.9)', type: 'spark' });
    }
    this.add({ x, y, life: 0.3, size: 0.13, color: '#ffffff', type: 'star', rot: 0.4, vr: 5 });
  }
}
