// Screen-space UI: every text and widget goes through here so we can measure,
// fit, hit-test, and assert that nothing overlaps.

export const FONT = '"Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

export class UI {
  constructor(ctx) {
    this.ctx = ctx;
    this.w = 0;
    this.h = 0;
    this.u = 1;
    this.rects = [];
    this.buttons = [];
    this.debug = false;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.u = Math.max(0.78, Math.min(1.5, Math.min(w, h) / 420));
  }

  begin() {
    this.rects.length = 0;
    this.buttons.length = 0;
  }

  record(r, tag, group) {
    this.rects.push({ ...r, tag, group: group || tag });
    return r;
  }

  font(size) {
    return `600 ${Math.round(size)}px ${FONT}`;
  }

  // Draw text fitted into maxW (shrinks down to 62% of size, then ellipsizes). Returns its rect.
  text(str, x, y, o = {}) {
    const ctx = this.ctx;
    let size = o.size || 18 * this.u;
    const maxW = o.maxW || Infinity;
    ctx.font = this.font(size);
    let w = ctx.measureText(str).width;
    if (w > maxW) {
      const s2 = Math.max(size * 0.62, (size * maxW) / w);
      size = s2;
      ctx.font = this.font(size);
      w = ctx.measureText(str).width;
      while (w > maxW && str.length > 2) {
        str = str.slice(0, -2) + '…';
        w = ctx.measureText(str).width;
      }
    }
    const align = o.align || 'left';
    const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const top = y - size * 0.5; // text is vertically centered on y
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    if (o.stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = o.strokeW || Math.max(2, size * 0.16);
      ctx.strokeStyle = o.stroke;
      ctx.strokeText(str, left, y + size * 0.04);
    }
    ctx.fillStyle = o.color || '#fff';
    ctx.fillText(str, left, y + size * 0.04);
    ctx.globalAlpha = 1;
    const r = { x: left, y: top, w, h: size };
    if (!o.noRecord) this.record(r, o.tag || 'text:' + str, o.group);
    return r;
  }

  measure(str, size) {
    this.ctx.font = this.font(size);
    return this.ctx.measureText(str).width;
  }

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  panel(x, y, w, h, o = {}) {
    const ctx = this.ctx;
    this.roundRect(x, y, w, h, o.r ?? 18 * this.u);
    ctx.fillStyle = o.fill || 'rgba(28,20,14,0.82)';
    ctx.fill();
    if (o.border !== false) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = o.border || 'rgba(255,240,210,0.25)';
      ctx.stroke();
    }
    if (o.record) this.record({ x, y, w, h }, o.tag || 'panel', o.group);
  }

  // Chunky game button with a drop edge. icon: optional draw(ctx, cx, cy, s).
  button(id, label, x, y, w, h, o = {}) {
    const ctx = this.ctx;
    const u = this.u;
    const pressed = this.pressedId === id;
    const col = o.color || '#ffb020';
    const dark = o.dark || '#a35f00';
    const dy = pressed ? 3 * u : 0;
    if (o.disabled) ctx.globalAlpha = 0.45;
    this.roundRect(x, y + 5 * u, w, h - 5 * u, 14 * u);
    ctx.fillStyle = dark;
    ctx.fill();
    this.roundRect(x, y + dy, w, h - 5 * u, 14 * u);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.stroke();
    // top shine
    this.roundRect(x + 6 * u, y + dy + 4 * u, w - 12 * u, (h - 5 * u) * 0.32, 10 * u);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    const cy = y + dy + (h - 5 * u) / 2;
    let tx = x + w / 2;
    const size = o.size || Math.min(22 * u, h * 0.42);
    const iconS = size * 1.05;
    let lw = label ? this.measure(label, size) : 0;
    const maxLabel = w - 20 * u - (o.icon ? iconS + 8 * u : 0) - (o.ad ? 34 * u : 0);
    if (lw > maxLabel) lw = maxLabel;
    let total = lw + (o.icon ? iconS + (label ? 8 * u : 0) : 0) + (o.ad ? 34 * u : 0);
    let cx0 = x + w / 2 - total / 2;
    if (o.ad) {
      drawAdBadge(ctx, cx0, cy, 28 * u, 20 * u);
      cx0 += 34 * u;
    }
    if (o.icon) {
      o.icon(ctx, cx0 + iconS / 2, cy, iconS);
      cx0 += iconS + 8 * u;
    }
    if (label) {
      this.text(label, cx0, cy, { size, maxW: maxLabel, color: o.textColor || '#fff', stroke: o.textStroke || 'rgba(0,0,0,0.35)', strokeW: 3 * u, group: 'btn:' + id, noRecord: true });
    }
    ctx.globalAlpha = 1;
    const r = { x, y, w, h };
    this.record(r, 'btn:' + id, 'btn:' + id);
    if (!o.disabled) this.buttons.push({ id, ...r });
    return r;
  }

  hit(px, py) {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b.id;
    }
    return null;
  }

  // Pairs of recorded rects (different groups) that overlap by more than 1px.
  overlaps() {
    const out = [];
    const R = this.rects;
    for (let i = 0; i < R.length; i++)
      for (let j = i + 1; j < R.length; j++) {
        const a = R[i], b = R[j];
        if (a.group === b.group || a.container === b.group || b.container === a.group) continue;
        if (a.tag.startsWith('panel') || b.tag.startsWith('panel')) continue;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox > 1 && oy > 1) out.push([a.tag, b.tag]);
      }
    // offscreen check
    for (const a of R) if (a.x < -1 || a.y < -1 || a.x + a.w > this.w + 1 || a.y + a.h > this.h + 1) out.push([a.tag, 'OFFSCREEN']);
    return out;
  }
}

export function drawAdBadge(ctx, x, cy, w, h) {
  ctx.save();
  const y = cy - h / 2;
  ctx.beginPath();
  const r = h * 0.3;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.fillStyle = '#e0412f';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.38, y + h * 0.25);
  ctx.lineTo(x + w * 0.7, y + h * 0.5);
  ctx.lineTo(x + w * 0.38, y + h * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---- icons (drawn centered at cx, cy with size s) ----
export const ICON = {
  pause(ctx, cx, cy, s) {
    ctx.fillStyle = '#fff';
    const w = s * 0.18, h = s * 0.55;
    ctx.fillRect(cx - w * 1.6, cy - h / 2, w, h);
    ctx.fillRect(cx + w * 0.6, cy - h / 2, w, h);
  },
  play(ctx, cx, cy, s) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.22, cy - s * 0.3);
    ctx.lineTo(cx + s * 0.3, cy);
    ctx.lineTo(cx - s * 0.22, cy + s * 0.3);
    ctx.closePath();
    ctx.fill();
  },
  retry(ctx, cx, cy, s) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = s * 0.14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.3, -0.4, Math.PI * 1.45);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    const ax = cx + s * 0.3 * Math.cos(-0.4), ay = cy + s * 0.3 * Math.sin(-0.4);
    ctx.moveTo(ax + s * 0.16, ay - s * 0.02);
    ctx.lineTo(ax - s * 0.06, ay - s * 0.2);
    ctx.lineTo(ax - s * 0.08, ay + s * 0.08);
    ctx.closePath();
    ctx.fill();
  },
  grid(ctx, cx, cy, s) {
    ctx.fillStyle = '#fff';
    const c = s * 0.2, g = s * 0.08;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) ctx.fillRect(cx - c - g / 2 + i * (c + g), cy - c - g / 2 + j * (c + g), c, c);
  },
  next(ctx, cx, cy, s) {
    ctx.fillStyle = '#fff';
    for (const o of [-0.16, 0.12]) {
      ctx.beginPath();
      ctx.moveTo(cx + (o - 0.12) * s, cy - s * 0.26);
      ctx.lineTo(cx + (o + 0.16) * s, cy);
      ctx.lineTo(cx + (o - 0.12) * s, cy + s * 0.26);
      ctx.closePath();
      ctx.fill();
    }
  },
  rewind(ctx, cx, cy, s) {
    ctx.fillStyle = '#fff';
    for (const o of [0.16, -0.12]) {
      ctx.beginPath();
      ctx.moveTo(cx + (o + 0.12) * s, cy - s * 0.26);
      ctx.lineTo(cx + (o - 0.16) * s, cy);
      ctx.lineTo(cx + (o + 0.12) * s, cy + s * 0.26);
      ctx.closePath();
      ctx.fill();
    }
  },
  sound(on) {
    return (ctx, cx, cy, s) => {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.32, cy - s * 0.12);
      ctx.lineTo(cx - s * 0.16, cy - s * 0.12);
      ctx.lineTo(cx + s * 0.04, cy - s * 0.3);
      ctx.lineTo(cx + s * 0.04, cy + s * 0.3);
      ctx.lineTo(cx - s * 0.16, cy + s * 0.12);
      ctx.lineTo(cx - s * 0.32, cy + s * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = s * 0.08;
      ctx.lineCap = 'round';
      if (on) {
        ctx.beginPath();
        ctx.arc(cx + s * 0.06, cy, s * 0.18, -0.9, 0.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + s * 0.06, cy, s * 0.32, -0.9, 0.9);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(cx + s * 0.14, cy - s * 0.14);
        ctx.lineTo(cx + s * 0.38, cy + s * 0.14);
        ctx.moveTo(cx + s * 0.38, cy - s * 0.14);
        ctx.lineTo(cx + s * 0.14, cy + s * 0.14);
        ctx.stroke();
      }
    };
  },
  note(on) {
    return (ctx, cx, cy, s) => {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.ellipse(cx - s * 0.12, cy + s * 0.18, s * 0.11, s * 0.08, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.03, cy + s * 0.16);
      ctx.lineTo(cx - s * 0.03, cy - s * 0.3);
      ctx.lineTo(cx + s * 0.22, cy - s * 0.2);
      ctx.stroke();
      if (!on) {
        ctx.strokeStyle = '#ff5a4a';
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.32, cy - s * 0.32);
        ctx.lineTo(cx + s * 0.32, cy + s * 0.32);
        ctx.stroke();
      }
    };
  },
};

export function drawStar(ctx, cx, cy, r, filled, t = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(t, t);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd23f' : 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.strokeStyle = filled ? '#a8670a' : 'rgba(255,255,255,0.35)';
  ctx.stroke();
  ctx.restore();
}

// Small egg icon for HUD trays. state: 'alive' | 'saved' | 'broken' | 'empty'
export function drawEggIcon(ctx, cx, cy, s, state, cracks = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  const h = s, w = s * 0.75;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    const sy = Math.sin(t);
    const x = (w / 2) * Math.cos(t) * (1 + 0.13 * sy);
    const y = (h / 2) * sy;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  if (state === 'empty') {
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (state === 'broken') {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    ctx.strokeStyle = '#ff6b5a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, -h * 0.05);
    ctx.lineTo(-w * 0.12, h * 0.08);
    ctx.lineTo(w * 0.05, -h * 0.08);
    ctx.lineTo(w * 0.35, h * 0.05);
    ctx.stroke();
  } else {
    ctx.fillStyle = state === 'saved' ? '#fff3d6' : 'rgba(255,243,214,0.55)';
    ctx.fill();
    ctx.strokeStyle = state === 'saved' ? '#6b4a20' : 'rgba(107,74,32,0.6)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    if (cracks > 0) {
      ctx.strokeStyle = '#6b4a20';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-w * 0.3, h * 0.05);
      ctx.lineTo(-w * 0.05, -h * 0.05);
      ctx.lineTo(w * 0.1, h * 0.1);
      ctx.stroke();
    }
    if (state === 'saved') {
      ctx.strokeStyle = '#2f9d4a';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-w * 0.22, 0);
      ctx.lineTo(-w * 0.04, h * 0.16);
      ctx.lineTo(w * 0.26, -h * 0.14);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Fox mascot head (used on title and fail screens). Screen space.
export function drawFox(ctx, cx, cy, s, mood = 'smug', t = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s / 100, s / 100);
  const or = '#ef7a24', dk = '#9b3f0e', wh = '#fff4e6';
  // ears
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 18, -30);
    ctx.lineTo(sx * 42, -68 + Math.sin(t * 2 + sx) * 2);
    ctx.lineTo(sx * 48, -18);
    ctx.closePath();
    ctx.fillStyle = or;
    ctx.fill();
    ctx.strokeStyle = dk;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx * 26, -30);
    ctx.lineTo(sx * 40, -56);
    ctx.lineTo(sx * 42, -26);
    ctx.closePath();
    ctx.fillStyle = '#3a1a0a';
    ctx.fill();
  }
  // head
  ctx.beginPath();
  ctx.moveTo(-50, -18);
  ctx.quadraticCurveTo(-56, 12, -30, 26);
  ctx.lineTo(0, 46);
  ctx.lineTo(30, 26);
  ctx.quadraticCurveTo(56, 12, 50, -18);
  ctx.quadraticCurveTo(0, -48, -50, -18);
  ctx.closePath();
  ctx.fillStyle = or;
  ctx.fill();
  ctx.strokeStyle = dk;
  ctx.lineWidth = 3;
  ctx.stroke();
  // cheeks
  ctx.beginPath();
  ctx.moveTo(-48, 0);
  ctx.quadraticCurveTo(-30, 8, -12, 22);
  ctx.lineTo(0, 46);
  ctx.lineTo(12, 22);
  ctx.quadraticCurveTo(30, 8, 48, 0);
  ctx.quadraticCurveTo(40, 28, 0, 46);
  ctx.quadraticCurveTo(-40, 28, -48, 0);
  ctx.fillStyle = wh;
  ctx.fill();
  // eyes
  ctx.fillStyle = '#2a140a';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    if (mood === 'smug') {
      ctx.moveTo(sx * 30, -6);
      ctx.quadraticCurveTo(sx * 20, -14, sx * 10, -6);
      ctx.quadraticCurveTo(sx * 20, -2, sx * 30, -6);
    } else {
      ctx.ellipse(sx * 20, -6, 6, 8, 0, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  // nose
  ctx.beginPath();
  ctx.ellipse(0, 36, 7, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#2a140a';
  ctx.fill();
  // grin
  if (mood === 'smug') {
    ctx.strokeStyle = '#2a140a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-12, 28);
    ctx.quadraticCurveTo(0, 34, 14, 24);
    ctx.stroke();
  }
  ctx.restore();
}
