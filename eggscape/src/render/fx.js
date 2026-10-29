// Particle VFX in world space (meters, y up). Cheap, pooled, capped.
const MAX = 520;

export class FX {
  constructor() {
    this.p = [];
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#fff';
    this.punch = 0;
    this.rings = []; // shockwaves
  }

  add(o) {
    if (this.p.length >= MAX) this.p.shift();
    const q = { x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, life: 1, size: 0.05, grow: 0, color: '#fff', type: 'dot', rot: 0, vr: 0, alpha: 1, ...o };
    q.max = q.life;
    this.p.push(q);
    return q;
  }

  burst(x, y, n, f) {
    for (let i = 0; i < n; i++) this.add(f(i, Math.random(), Math.random()));
  }

  wave(x, y, r, color, life = 0.45, width = 0.08) {
    this.rings.push({ x, y, r, color, life, max: life, width });
  }

  update(dt) {
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.2);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    if (this.punch > 0) this.punch = Math.max(0, this.punch - dt * 2.5);
    const p = this.p;
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      q.life -= dt;
      if (q.life <= 0) { p.splice(i, 1); continue; }
      q.vy -= q.g * dt;
      if (q.drag) { const k = Math.max(0, 1 - q.drag * dt); q.vx *= k; q.vy *= k; }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.vr * dt;
      q.size += q.grow * dt;
      if (q.floor !== undefined && q.y < q.floor) { q.y = q.floor; q.vy = 0; q.vx *= 0.5; }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const w = this.rings[i];
      w.life -= dt;
      if (w.life <= 0) this.rings.splice(i, 1);
    }
  }

  // ctx is in world space (scale k, y flipped)
  draw(ctx, layer) {
    for (const q of this.p) {
      if ((q.layer || 'front') !== layer) continue;
      const t = q.life / q.max;
      const a = q.alpha * (q.fade === false ? 1 : Math.min(1, t * 2.2));
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = q.color;
      switch (q.type) {
        case 'dot':
          ctx.beginPath();
          ctx.arc(q.x, q.y, Math.max(0.005, q.size), 0, 6.283);
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
        case 'smoke':
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.size, 0, 6.283);
          ctx.fill();
          break;
        case 'spark': {
          ctx.strokeStyle = q.color;
          ctx.lineWidth = q.size;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03);
          ctx.stroke();
          break;
        }
        case 'star': {
          const s = q.size;
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(q.rot);
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const r = k % 2 ? s * 0.38 : s;
            const an = (k / 8) * 6.283;
            ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'chip': {
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(q.rot);
          ctx.fillRect(-q.size, -q.size * 0.5, q.size * 2, q.size);
          ctx.restore();
          break;
        }
        case 'splat': {
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, q.size * 1.6, q.size * 0.45, 0, 0, 6.283);
          ctx.fill();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
    for (const w of this.rings) {
      const t = 1 - w.life / w.max;
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = w.width * (1 - t) + 0.01;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r * (0.2 + 0.8 * Math.sqrt(t)), 0, 6.283);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- presets ----
  dust(x, y, n = 6, color = 'rgba(230,220,200,0.8)') {
    this.burst(x, y, n, (i, a, b) => ({ x, y, vx: (a - 0.5) * 2.2, vy: b * 1.2, drag: 3, life: 0.5 + b * 0.3, size: 0.05 + a * 0.05, grow: 0.12, color, type: 'smoke' }));
  }
  yolk(x, y, floor) {
    this.burst(x, y, 16, (i, a, b) => ({ x, y, vx: (a - 0.5) * 5, vy: 1 + b * 3.5, g: 12, life: 0.9 + b * 0.5, size: 0.035 + a * 0.05, color: i % 3 ? '#ffc21a' : '#ffe9a8', type: 'dot', floor }));
    this.add({ x, y, life: 1.6, size: 0.25, color: 'rgba(255,190,30,0.85)', type: 'splat', layer: 'back', fade: true });
  }
  sparkle(x, y, n = 10, color = '#fff6c2') {
    this.burst(x, y, n, (i, a, b) => {
      const an = a * 6.283, sp = 1 + b * 2.4;
      return { x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, drag: 2.5, life: 0.6 + b * 0.4, size: 0.06 + a * 0.06, color, type: 'star', vr: 4 };
    });
  }
  flameAt(x, y, scale = 1, vx = 0, vy = 0) {
    const a = Math.random();
    this.add({ x: x + (a - 0.5) * 0.18 * scale, y, vx: vx * 0.6 + (Math.random() - 0.5) * 0.4, vy: vy * 0.6 + 1.1 + Math.random() * 0.9, drag: 1.5, life: 0.35 + Math.random() * 0.25, size: (0.07 + Math.random() * 0.06) * scale, grow: -0.08, color: a > 0.5 ? '#ff7a1a' : '#ff4d12', hot: '#ffe27a', type: 'flame' });
    if (Math.random() < 0.18) this.add({ x, y: y + 0.1, vx: (Math.random() - 0.5) * 0.8, vy: 1.6 + Math.random(), drag: 0.6, life: 0.8, size: 0.018, color: '#ffb347', type: 'dot' });
  }
  smoke(x, y, n = 4, color = 'rgba(60,55,60,0.55)') {
    this.burst(x, y, n, (i, a, b) => ({ x: x + (a - 0.5) * 0.3, y, vx: (a - 0.5) * 0.6, vy: 0.6 + b * 0.8, drag: 0.8, life: 1 + b * 0.6, size: 0.1 + a * 0.08, grow: 0.25, color, type: 'smoke' }));
  }
  explosion(x, y, R) {
    this.flash = 1;
    this.flashColor = '#fff2c4';
    this.shake = 1;
    this.wave(x, y, R * 1.3, '#fff3d0', 0.5, 0.25);
    this.burst(x, y, 26, (i, a, b) => {
      const an = a * 6.283, sp = 2 + b * 6;
      return { x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, drag: 3.5, life: 0.35 + b * 0.35, size: 0.14 + a * 0.16, grow: -0.2, color: i % 2 ? '#ff8a1c' : '#ffd23f', hot: '#fff7c9', type: 'flame' };
    });
    this.burst(x, y, 12, (i, a, b) => ({ x, y, vx: (a - 0.5) * 3, vy: b * 2.5, drag: 1.2, life: 1.4 + b, size: 0.2 + a * 0.15, grow: 0.4, color: 'rgba(55,50,55,0.6)', type: 'smoke' }));
    this.burst(x, y, 18, (i, a, b) => {
      const an = a * 6.283, sp = 4 + b * 7;
      return { x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: 6, life: 0.4 + b * 0.4, size: 0.03, color: '#ffe08a', type: 'spark' };
    });
  }
  chips(x, y, color, n = 8, speed = 2.5) {
    this.burst(x, y, n, (i, a, b) => ({ x, y, vx: (a - 0.5) * speed * 2, vy: b * speed, g: 9, life: 0.8 + b * 0.5, size: 0.03 + a * 0.04, color, type: 'chip', rot: a * 6, vr: (b - 0.5) * 20 }));
  }
}
