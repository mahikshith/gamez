// Screen-space UI: every text and widget goes through here so we can measure,
// fit, hit-test, and assert that nothing overlaps.
//
// UI KIT (2026-11 premium pass). One light direction (top-left), three surfaces:
//   frame()  cream card in a bevelled wooden frame (dialogs, shop cards), optional ribbon() header
//   well()   recessed area inside a card (stat tables, art stages)
//   glass()  dark translucent capsule for the HUD and anything that floats over the board
// Buttons have a hierarchy by kind: primary (green, shimmer) > secondary (blue) / gold / ad (violet: every
// rewarded ad looks the same) > tertiary (cream, brown ink) > hud (dark glass). Spacing scale: 4 8 12 16 24 u.

export const FONT = '"Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

// palette: ink on cream, cream, outline
export const C = {
  ink: '#5b3413', ink2: '#8a6238', cream: '#fff6e0', cream2: '#f4e0b8', line: '#4a2a12',
  good: '#2f8f2a', warn: '#c9540c', info: '#1f6fb5', gold: '#ffcf3a', bad: '#d83a2a',
};

const KIND = {
  primary: { a: '#93ea52', b: '#3eb42d', lip: '#237f1d', line: '#134f0f', ink: '#fff' },
  secondary: { a: '#7fc3ff', b: '#3a80ea', lip: '#2355b3', line: '#133878', ink: '#fff' },
  gold: { a: '#ffe274', b: '#f6a21b', lip: '#b46b08', line: '#6b3d04', ink: '#fff' },
  ad: { a: '#c7a0ff', b: '#7a48e8', lip: '#4b2aa6', line: '#2b1566', ink: '#fff' },
  orange: { a: '#ffc060', b: '#f3781c', lip: '#ae4a09', line: '#692b04', ink: '#fff' },
  red: { a: '#ff927c', b: '#e0412d', lip: '#9a2316', line: '#5a110a', ink: '#fff' },
  tertiary: { a: '#fff8e6', b: '#efd8ab', lip: '#b9935d', line: '#7a5630', ink: '#6b3f17' },
  hud: { a: 'rgba(86,56,32,0.94)', b: 'rgba(48,29,15,0.94)', lip: 'rgba(22,12,5,0.92)', line: 'rgba(18,9,3,0.9)', ink: '#fff', rim: 'rgba(255,232,190,0.5)' },
  off: { a: '#cdc0ae', b: '#a09383', lip: '#6d6257', line: '#463d34', ink: '#fff' },
};
const LEGACY = { '#46b83d': 'primary', '#5a8dee': 'secondary', '#4a8fe8': 'secondary', '#d49a1c': 'gold', '#e0a526': 'gold', '#ffb020': 'gold', '#9b59d0': 'ad', '#6a5a4a': 'off', '#7c7064': 'off', '#5a4a3a': 'off', '#6d5a48': 'off', '#7a6552': 'off', '#8a6a4a': 'tertiary', '#d8452f': 'red' };

// hex colour moved toward white (k > 0) or black (k < 0)
export function tint(hex, k) {
  const n = parseInt(hex.slice(1), 16), t = k > 0 ? 255 : 0, a = Math.abs(k);
  const f = (v) => Math.round(v + (t - v) * a);
  return '#' + ((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0');
}
export function mix(h1, h2, k) {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const f = (s) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k);
  return '#' + ((f(16) << 16) | (f(8) << 8) | f(0)).toString(16).padStart(6, '0');
}
// a button palette from one base colour (level tiles, anything themed)
export const faceOf = (hex) => ({ a: tint(hex, 0.32), b: hex, lip: tint(hex, -0.38), line: tint(hex, -0.66), ink: '#fff' });

const backOut = (p) => { const c = 1.9; p = Math.min(1, Math.max(0, p)); return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };

let INK = '#fff'; // the colour the glyph icons draw in (a button sets it to its ink, and to a shade for the icon's drop edge)

export class UI {
  constructor(ctx) {
    this.ctx = ctx;
    this.w = 0;
    this.h = 0;
    this.u = 1;
    this.rects = [];
    this.buttons = [];
    this.debug = false;
    this.fr = 0; // frames drawn: drives the press springs and the CTA shimmer
    this.calm = false; // reduced motion: no squash, no shimmer
    this.spring = {};
    this.C = C;
    this.aBase = 1; // alpha every text returns to (a fading panel sets it for its own draw)
    this.lock = drawLock;
    this.tint = tint;
    this.mix = mix;
    this.faceOf = faceOf;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.u = Math.max(0.78, Math.min(1.5, Math.min(w, h) / 420));
  }

  begin() {
    this.rects.length = 0;
    this.buttons.length = 0;
    this.fr++;
  }

  record(r, tag, group) {
    this.rects.push({ ...r, tag, group: group || tag });
    return r;
  }

  font(size) {
    return `600 ${Math.round(size)}px ${FONT}`;
  }

  // Draw text fitted into maxW (shrinks down to 62% of size, then ellipsizes). Returns its rect.
  // o.shadow: colour of a hard drop edge under the glyphs; o.grad: [top, bottom] fill
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
    const by = y + size * 0.04;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha * this.aBase;
    ctx.lineJoin = 'round';
    const sw = o.strokeW || Math.max(2, size * 0.16);
    if (o.shadow) {
      const d = o.shadowD || size * 0.08;
      ctx.lineWidth = o.stroke ? sw : Math.max(1, size * 0.04);
      ctx.strokeStyle = o.shadow;
      ctx.fillStyle = o.shadow;
      if (o.stroke) ctx.strokeText(str, left, by + d);
      ctx.fillText(str, left, by + d);
    }
    if (o.stroke) {
      ctx.lineWidth = sw;
      ctx.strokeStyle = o.stroke;
      ctx.strokeText(str, left, by);
    }
    if (o.grad) {
      const g = ctx.createLinearGradient(0, top, 0, top + size);
      g.addColorStop(0.15, o.grad[0]);
      g.addColorStop(0.85, o.grad[1]);
      ctx.fillStyle = g;
    } else ctx.fillStyle = o.color || '#fff';
    ctx.fillText(str, left, by);
    ctx.globalAlpha = this.aBase; // as before the kit: text leaves alpha at the base (1 unless a panel is fading in)
    const r = { x: left, y: top, w, h: size };
    if (!o.noRecord) this.record(r, o.tag || 'text:' + str, o.group);
    return r;
  }

  // Bold display numerals (score, timer, coins): gold face, dark stroke, a hard drop edge.
  num(str, x, y, o = {}) {
    const size = o.size || 24 * this.u;
    return this.text(str, x, y, { grad: o.color ? null : ['#fff8cf', '#ffc22e'], stroke: '#4a2408', strokeW: Math.max(2.5, size * 0.15), shadow: '#4a2408', shadowD: size * 0.075, ...o, size });
  }

  measure(str, size) {
    this.ctx.font = this.font(size);
    return this.ctx.measureText(str).width;
  }

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    r = Math.max(0, Math.min(r, h / 2, w / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // soft drop shadow without shadowBlur: three stacked translucent rounded rects
  shadow(x, y, w, h, r, d = 6 * this.u, a = 0.1) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(20,8,0,${a})`;
    for (let i = 0; i < 3; i++) {
      const g = d * (0.25 + i * 0.3);
      this.roundRect(x - g * 0.5, y + d * 0.55 - g * 0.2, w + g, h + g * 0.9, r + g * 0.5);
      ctx.fill();
    }
  }

  // legacy flat panel (kept for callers that just want a tinted rounded box)
  panel(x, y, w, h, o = {}) {
    const ctx = this.ctx;
    this.roundRect(x, y, w, h, o.r ?? 18 * this.u);
    ctx.fillStyle = o.fill || 'rgba(28,20,14,0.82)';
    ctx.fill();
    if (o.border !== false) {
      ctx.lineWidth = o.lw || 2;
      ctx.strokeStyle = o.border || 'rgba(255,240,210,0.25)';
      ctx.stroke();
    }
    if (o.record) this.record({ x, y, w, h }, o.tag || 'panel', o.group);
  }

  // Dark glass capsule: HUD chips, toasts, anything floating over the board.
  glass(x, y, w, h, o = {}) {
    const ctx = this.ctx, u = this.u, r = o.r ?? h / 2;
    if (o.shadow !== false) { this.roundRect(x, y + 2.5 * u, w, h, r); ctx.fillStyle = 'rgba(10,4,0,0.28)'; ctx.fill(); }
    this.roundRect(x, y, w, h, r);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, o.a || 'rgba(72,46,26,0.9)');
    g.addColorStop(1, o.b || 'rgba(34,20,10,0.9)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = o.lw || 1.5 * u;
    ctx.strokeStyle = o.border || 'rgba(255,232,190,0.42)';
    ctx.stroke();
    // inner top light
    ctx.save();
    this.roundRect(x, y, w, h, r);
    ctx.clip();
    this.roundRect(x + 2 * u, y + 2 * u, w - 4 * u, h, r - 2 * u);
    ctx.lineWidth = 1.5 * u;
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.stroke();
    ctx.restore();
    if (o.record) this.record({ x, y, w, h }, o.tag || 'panel', o.group);
  }

  // Cream card in a bevelled wooden frame, lit from the top-left, with a base lip and a soft shadow.
  // o.s: scale (default u), o.fw: frame width, o.r, o.glow: colour of an attention ring (0..1 alpha in o.glowA)
  frame(x, y, w, h, o = {}) {
    const ctx = this.ctx, s = o.s || this.u, r = o.r ?? 22 * s, fw = o.fw ?? 7 * s, lip = o.lip ?? 5 * s;
    if (o.shadow !== false) this.shadow(x, y + lip, w, h, r, 10 * s, 0.11);
    if (o.glow && o.glowA > 0.01) {
      ctx.globalAlpha *= o.glowA;
      this.roundRect(x - 3 * s, y - 3 * s, w + 6 * s, h + lip + 6 * s, r + 3 * s);
      ctx.fillStyle = o.glow;
      ctx.fill();
      ctx.globalAlpha /= o.glowA;
    }
    // outline + base lip
    this.roundRect(x, y, w, h + lip, r);
    ctx.fillStyle = o.line || C.line;
    ctx.fill();
    this.roundRect(x + 1.5 * s, y + 1.5 * s, w - 3 * s, h + lip - 3 * s, r - 1.5 * s);
    ctx.fillStyle = o.base || '#8a5226';
    ctx.fill();
    // wood frame
    this.roundRect(x + 1.5 * s, y + 1.5 * s, w - 3 * s, h - 3 * s, r - 1.5 * s);
    const g = ctx.createLinearGradient(x, y, x + w * 0.25, y + h);
    g.addColorStop(0, o.wa || '#f0b972');
    g.addColorStop(0.5, o.wb || '#cf8c48');
    g.addColorStop(1, o.wc || '#b06f34');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.2 * s;
    ctx.strokeStyle = 'rgba(255,240,205,0.55)';
    this.roundRect(x + 3 * s, y + 3 * s, w - 6 * s, h - 6 * s, r - 3 * s);
    ctx.stroke();
    // cream body
    const bx = x + fw, by = y + fw, bw = w - 2 * fw, bh = h - 2 * fw, br = Math.max(2, r - fw);
    this.roundRect(bx - 1.2 * s, by - 1.2 * s, bw + 2.4 * s, bh + 2.4 * s, br + 1.2 * s);
    ctx.fillStyle = 'rgba(94,52,18,0.85)';
    ctx.fill();
    this.roundRect(bx, by, bw, bh, br);
    const b = ctx.createLinearGradient(0, by, 0, by + bh);
    b.addColorStop(0, o.ca || '#fffaea');
    b.addColorStop(1, o.cb || '#f6e2ba');
    ctx.fillStyle = b;
    ctx.fill();
    // the frame casts a soft shade on the top-left of the body
    ctx.save();
    ctx.clip();
    const sh = ctx.createLinearGradient(0, by, 0, by + 12 * s);
    sh.addColorStop(0, 'rgba(140,84,30,0.24)');
    sh.addColorStop(1, 'rgba(140,84,30,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(bx, by, bw, 12 * s);
    ctx.restore();
    if (o.record) this.record({ x, y, w, h }, o.tag || 'panel', o.group);
    return { x: bx, y: by, w: bw, h: bh };
  }

  // Recessed area inside a card. o.a / o.b: fill gradient (default a darker cream)
  well(x, y, w, h, o = {}) {
    const ctx = this.ctx, s = o.s || this.u, r = o.r ?? 12 * s;
    this.roundRect(x, y + 1.5 * s, w, h, r);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
    this.roundRect(x, y, w, h, r);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, o.a || '#ecd3a2');
    g.addColorStop(1, o.b || o.a || '#f0dbb0');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const sh = ctx.createLinearGradient(0, y, 0, y + 9 * s);
    sh.addColorStop(0, o.shade || 'rgba(96,56,16,0.3)');
    sh.addColorStop(1, 'rgba(96,56,16,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(x, y, w, 9 * s);
    if (o.paint) o.paint();
    ctx.restore();
    this.roundRect(x, y, w, h, r);
    ctx.lineWidth = 1.5 * s;
    ctx.strokeStyle = o.border || 'rgba(110,66,24,0.5)';
    ctx.stroke();
  }

  // Header ribbon with folded tails, centred on cx; (y, h) is the band. o.color: base hex.
  ribbon(text, cx, y, w, h, o = {}) {
    const ctx = this.ctx, s = o.s || this.u, c = o.color || '#e8503a';
    const dark = tint(c, -0.34), line = tint(c, -0.62), x = cx - w / 2, tail = Math.min(16 * s, h * 0.5), drop = h * 0.22;
    // tails
    for (const d of [-1, 1]) {
      const ex = d < 0 ? x : x + w;
      ctx.beginPath();
      ctx.moveTo(ex + d * -8 * s, y + drop);
      ctx.lineTo(ex + d * tail, y + drop);
      ctx.lineTo(ex + d * (tail - h * 0.26), y + drop + h * 0.5);
      ctx.lineTo(ex + d * tail, y + drop + h);
      ctx.lineTo(ex + d * -8 * s, y + drop + h);
      ctx.closePath();
      ctx.fillStyle = dark;
      ctx.fill();
      ctx.lineWidth = 1.5 * s;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = line;
      ctx.stroke();
      // fold
      ctx.beginPath();
      ctx.moveTo(ex, y + h);
      ctx.lineTo(ex + d * -8 * s, y + h + drop);
      ctx.lineTo(ex + d * -8 * s, y + h - 1);
      ctx.closePath();
      ctx.fillStyle = line;
      ctx.fill();
    }
    // band
    this.roundRect(x, y + 2.5 * s, w, h, 5 * s);
    ctx.fillStyle = line;
    ctx.fill();
    this.roundRect(x, y, w, h, 5 * s);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, tint(c, 0.28));
    g.addColorStop(0.55, c);
    g.addColorStop(1, tint(c, -0.12));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.5 * s;
    ctx.strokeStyle = line;
    ctx.stroke();
    // stitch lines
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.2 * s;
    ctx.setLineDash([4 * s, 4 * s]);
    ctx.beginPath();
    ctx.moveTo(x + 6 * s, y + 4 * s); ctx.lineTo(x + w - 6 * s, y + 4 * s);
    ctx.moveTo(x + 6 * s, y + h - 4 * s); ctx.lineTo(x + w - 6 * s, y + h - 4 * s);
    ctx.stroke();
    ctx.setLineDash([]);
    if (text) this.text(text, cx, y + h / 2, { size: o.size || h * 0.6, align: 'center', maxW: w - 20 * s, color: '#fff', stroke: line, strokeW: Math.max(2.5, h * 0.11), shadow: line, tag: o.tag, group: o.group, noRecord: o.noRecord });
  }

  // 0 (rest) .. 1 (held down), a springy follow of the pressed state; one step per frame per id
  pressAmt(id, down) {
    let S = this.spring[id];
    if (!S) { if (!down) return 0; S = this.spring[id] = { v: 0, vel: 0, fr: this.fr - 1 }; }
    if (this.calm) { S.v = down ? 1 : 0; S.vel = 0; S.fr = this.fr; }
    for (let n = Math.min(4, this.fr - S.fr); n > 0; n--) { S.vel = (S.vel + ((down ? 1 : 0) - S.v) * 0.42) * 0.62; S.v += S.vel; }
    S.fr = this.fr;
    if (!down && Math.abs(S.v) < 0.004 && Math.abs(S.vel) < 0.004) { delete this.spring[id]; return 0; }
    return S.v;
  }

  // Chunky game button: outline, base lip, lit face, gloss; squashes when pressed. icon: optional draw(ctx, cx, cy, s).
  // o.kind: primary | secondary | gold | ad | orange | red | tertiary | hud | off;  o.face: a custom palette (faceOf)
  // o.shimmer: a light sweeps the face now and then (primary CTAs);  o.round: radius;  o.ad: ad badge before the label
  // Returns the rect; .dy = how far the face is pushed down this frame (for art drawn on top of it).
  button(id, label, x, y, w, h, o = {}) {
    const ctx = this.ctx;
    const u = this.u;
    const pressed = this.pressedId === id;
    let K = o.face || KIND[o.kind] || KIND[LEGACY[o.color]] || (o.color ? faceOf(o.color) : KIND.gold);
    if (o.disabled && !o.keepFace) K = KIND.off;
    const lip = Math.min(6 * u, h * 0.13) * (o.disabled ? 0.55 : 1);
    const p = this.pressAmt(id, pressed);
    const dy = lip * 0.75 * Math.max(0, Math.min(1.2, p));
    const rad = o.round ?? Math.min(15 * u, h * 0.34);
    const fh = h - lip;
    ctx.save();
    if (p && !this.calm) { // squash about the base
      const cx = x + w / 2, by = y + h;
      ctx.translate(cx, by);
      ctx.scale(1 + 0.035 * p, 1 - 0.045 * p);
      ctx.translate(-cx, -by);
    }
    if (o.disabled) ctx.globalAlpha *= o.dim ?? (o.keepFace ? 1 : 0.82);
    if (!o.ghost) {
    // contact shadow
    if (!o.flat) { this.roundRect(x - 0.5 * u, y + lip + 2.5 * u, w + u, fh, rad); ctx.fillStyle = 'rgba(16,6,0,0.22)'; ctx.fill(); }
    // base lip
    this.roundRect(x, y + lip, w, fh, rad);
    ctx.fillStyle = K.lip;
    ctx.fill();
    ctx.lineWidth = 2 * u;
    ctx.strokeStyle = K.line;
    ctx.stroke();
    // face
    this.roundRect(x, y + dy, w, fh, rad);
    const g = ctx.createLinearGradient(0, y + dy, 0, y + dy + fh);
    g.addColorStop(0, K.a);
    g.addColorStop(1, K.b);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.stroke();
    // gloss: a lighter top plane and a rim light
    ctx.save();
    ctx.clip();
    ctx.fillStyle = K === KIND.hud ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + dy, w * 0.62, fh * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    this.roundRect(x + 2.5 * u, y + dy + 2.5 * u, w - 5 * u, fh, Math.max(1, rad - 2.5 * u));
    ctx.lineWidth = 1.6 * u;
    ctx.strokeStyle = K.rim || 'rgba(255,255,255,0.5)';
    ctx.stroke();
    if (o.shimmer && !o.disabled && !this.calm) {
      const ph = ((this.fr + (o.shimmerOff || 0)) % 190) / 46;
      if (ph < 1) {
        const sx = x - h + (w + 2 * h) * ph;
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.beginPath();
        ctx.moveTo(sx, y + dy + fh); ctx.lineTo(sx + h * 0.55, y + dy); ctx.lineTo(sx + h * 0.95, y + dy); ctx.lineTo(sx + h * 0.4, y + dy + fh);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
    }
    const cy = y + dy + fh / 2;
    const size = o.size || Math.min(22 * u, h * 0.42);
    const iconS = (o.iconS || 1.05) * size;
    const adW = o.ad ? Math.min(34 * u, size * 2) : 0;
    let lw = label ? this.measure(label, size) : 0;
    const maxLabel = w - 20 * u - (o.icon ? iconS + 8 * u : 0) - adW;
    if (lw > maxLabel) lw = maxLabel;
    const total = lw + (o.icon ? iconS + (label ? 8 * u : 0) : 0) + adW;
    let cx0 = x + w / 2 - total / 2;
    if (o.ad) {
      drawAdBadge(ctx, cx0, cy, adW - 6 * u, (adW - 6 * u) * 0.72);
      cx0 += adW;
    }
    if (o.icon) {
      if (o.icon.glyph) { INK = K.line; ctx.globalAlpha *= 0.55; o.icon(ctx, cx0 + iconS / 2, cy + iconS * 0.07, iconS); ctx.globalAlpha /= 0.55; INK = K.ink; }
      o.icon(ctx, cx0 + iconS / 2, cy, iconS);
      INK = '#fff';
      cx0 += iconS + 8 * u;
    }
    if (label) {
      const dark = K.ink !== '#fff';
      this.text(label, cx0, cy, { size, maxW: maxLabel, color: o.textColor || K.ink, stroke: dark || o.ghost ? null : K.line, strokeW: Math.max(2 * u, size * 0.15), shadow: o.ghost || (!dark && size < 17 * u) ? null : dark ? 'rgba(255,255,255,0.7)' : K.line, shadowD: dark ? size * 0.05 : size * 0.07, group: 'btn:' + id, noRecord: true });
    }
    ctx.restore();
    const r = o.hit || { x, y, w, h }; // o.hit: a larger tap/record rect than the drawn face (segmented rows)
    this.record(r, 'btn:' + id, 'btn:' + id);
    if (!o.disabled) this.buttons.push({ id, ...r });
    return { x, y, w, h, dy, cy };
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

  // pop-in for a panel: 0.86 -> overshoot -> 1 over ~0.3 s of screen time (1 when reduced motion is on)
  pop(t, dur = 0.3) { return this.calm || t >= dur ? 1 : 0.86 + 0.14 * backOut(t / dur); }
}

// "Watch a video" badge: a white film tile with a red play triangle. Every rewarded-ad button carries it.
export function drawAdBadge(ctx, x, cy, w, h) {
  ctx.save();
  const y = cy - h / 2, r = h * 0.28;
  const rr = (dx, dy) => {
    ctx.beginPath();
    ctx.moveTo(x + r + dx, y + dy);
    ctx.arcTo(x + w + dx, y + dy, x + w + dx, y + h + dy, r);
    ctx.arcTo(x + w + dx, y + h + dy, x + dx, y + h + dy, r);
    ctx.arcTo(x + dx, y + h + dy, x + dx, y + dy, r);
    ctx.arcTo(x + dx, y + dy, x + w + dx, y + dy, r);
    ctx.closePath();
  };
  rr(0, h * 0.1);
  ctx.fillStyle = 'rgba(30,10,60,0.45)';
  ctx.fill();
  rr(0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.fillStyle = '#e8402e';
  ctx.strokeStyle = '#e8402e';
  ctx.lineJoin = 'round';
  ctx.lineWidth = h * 0.1;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.4, y + h * 0.28);
  ctx.lineTo(x + w * 0.68, y + h * 0.5);
  ctx.lineTo(x + w * 0.4, y + h * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ---- icons (drawn centered at cx, cy with size s). One style: solid rounded glyphs in the button's ink;
// the button draws each twice (a darker drop edge, then the ink) so they sit on the face like the labels do.
const G_ = (f) => { f.glyph = true; return f; };
const tri = (ctx, x0, y0, x1, y1, x2, y2, s) => {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath();
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.09; ctx.fill(); ctx.stroke();
};
const bar = (ctx, x, y, w, h) => {
  const r = Math.min(w, h) / 2;
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  ctx.fillStyle = INK; ctx.fill();
};
export const ICON = {
  pause: G_((ctx, cx, cy, s) => { bar(ctx, cx - s * 0.27, cy - s * 0.3, s * 0.2, s * 0.6); bar(ctx, cx + s * 0.07, cy - s * 0.3, s * 0.2, s * 0.6); }),
  play: G_((ctx, cx, cy, s) => tri(ctx, cx - s * 0.2, cy - s * 0.28, cx + s * 0.3, cy, cx - s * 0.2, cy + s * 0.28, s)),
  retry: G_((ctx, cx, cy, s) => {
    ctx.strokeStyle = INK; ctx.lineWidth = s * 0.15; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.29, -0.35, Math.PI * 1.45); ctx.stroke();
    const ax = cx + s * 0.29 * Math.cos(-0.35), ay = cy + s * 0.29 * Math.sin(-0.35);
    tri(ctx, ax + s * 0.17, ay - s * 0.01, ax - s * 0.07, ay - s * 0.21, ax - s * 0.09, ay + s * 0.08, s * 0.6);
  }),
  grid: G_((ctx, cx, cy, s) => {
    const c = s * 0.25, g = s * 0.08;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const x = cx - c - g / 2 + i * (c + g), y = cy - c - g / 2 + j * (c + g); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, c, c, c * 0.28) : ctx.rect(x, y, c, c); ctx.fillStyle = INK; ctx.fill(); }
  }),
  next: G_((ctx, cx, cy, s) => { for (const o of [-0.17, 0.13]) tri(ctx, cx + (o - 0.1) * s, cy - s * 0.24, cx + (o + 0.15) * s, cy, cx + (o - 0.1) * s, cy + s * 0.24, s); }),
  rewind: G_((ctx, cx, cy, s) => { for (const o of [0.17, -0.13]) tri(ctx, cx + (o + 0.1) * s, cy - s * 0.24, cx + (o - 0.15) * s, cy, cx + (o + 0.1) * s, cy + s * 0.24, s); }),
  // a single chevron: back / world arrows
  left: G_((ctx, cx, cy, s) => { ctx.strokeStyle = INK; ctx.lineWidth = s * 0.19; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(cx + s * 0.12, cy - s * 0.27); ctx.lineTo(cx - s * 0.16, cy); ctx.lineTo(cx + s * 0.12, cy + s * 0.27); ctx.stroke(); }),
  right: G_((ctx, cx, cy, s) => { ctx.strokeStyle = INK; ctx.lineWidth = s * 0.19; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(cx - s * 0.12, cy - s * 0.27); ctx.lineTo(cx + s * 0.16, cy); ctx.lineTo(cx - s * 0.12, cy + s * 0.27); ctx.stroke(); }),
  // magnifier with + or -
  zoom(plus) {
    return G_((ctx, cx, cy, s) => {
      ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = s * 0.11;
      ctx.beginPath(); ctx.arc(cx - s * 0.06, cy - s * 0.06, s * 0.27, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = s * 0.15;
      ctx.beginPath(); ctx.moveTo(cx + s * 0.16, cy + s * 0.16); ctx.lineTo(cx + s * 0.34, cy + s * 0.34); ctx.stroke();
      ctx.lineWidth = s * 0.09;
      ctx.beginPath(); ctx.moveTo(cx - s * 0.19, cy - s * 0.06); ctx.lineTo(cx + s * 0.07, cy - s * 0.06);
      if (plus) { ctx.moveTo(cx - s * 0.06, cy - s * 0.19); ctx.lineTo(cx - s * 0.06, cy + s * 0.07); }
      ctx.stroke();
    });
  },
  // a day calendar (the daily vault)
  day: G_((ctx, cx, cy, s) => {
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.1;
    ctx.beginPath(); ctx.rect(cx - s * 0.27, cy - s * 0.2, s * 0.54, s * 0.48); ctx.stroke();
    ctx.fillRect(cx - s * 0.27, cy - s * 0.2, s * 0.54, s * 0.16);
    bar(ctx, cx - s * 0.19, cy - s * 0.36, s * 0.1, s * 0.2); bar(ctx, cx + s * 0.09, cy - s * 0.36, s * 0.1, s * 0.2);
    ctx.fillRect(cx - s * 0.07, cy + s * 0.04, s * 0.14, s * 0.13);
  }),
  check: G_((ctx, cx, cy, s) => { ctx.strokeStyle = INK; ctx.lineWidth = s * 0.17; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(cx - s * 0.26, cy + s * 0.02); ctx.lineTo(cx - s * 0.07, cy + s * 0.2); ctx.lineTo(cx + s * 0.28, cy - s * 0.2); ctx.stroke(); }),
  sound(on) {
    return G_((ctx, cx, cy, s) => {
      ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.32, cy - s * 0.11); ctx.lineTo(cx - s * 0.16, cy - s * 0.11); ctx.lineTo(cx + s * 0.04, cy - s * 0.28);
      ctx.lineTo(cx + s * 0.04, cy + s * 0.28); ctx.lineTo(cx - s * 0.16, cy + s * 0.11); ctx.lineTo(cx - s * 0.32, cy + s * 0.11);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
      if (on) {
        ctx.beginPath(); ctx.arc(cx + s * 0.06, cy, s * 0.17, -0.9, 0.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + s * 0.06, cy, s * 0.31, -0.9, 0.9); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(cx + s * 0.16, cy - s * 0.13); ctx.lineTo(cx + s * 0.4, cy + s * 0.13); ctx.moveTo(cx + s * 0.4, cy - s * 0.13); ctx.lineTo(cx + s * 0.16, cy + s * 0.13); ctx.stroke();
      }
    });
  },
  note(on) {
    return G_((ctx, cx, cy, s) => {
      ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.ellipse(cx - s * 0.13, cy + s * 0.2, s * 0.12, s * 0.09, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - s * 0.03, cy + s * 0.18); ctx.lineTo(cx - s * 0.03, cy - s * 0.28); ctx.lineTo(cx + s * 0.24, cy - s * 0.18); ctx.stroke();
      if (!on) { ctx.beginPath(); ctx.moveTo(cx - s * 0.3, cy - s * 0.3); ctx.lineTo(cx + s * 0.32, cy + s * 0.32); ctx.stroke(); }
    });
  },
};

// A padlock with form: steel shackle, gold body, keyhole. s = half width of the body.
export function drawLock(ctx, cx, cy, s, o = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = o.line || '#3a2410';
  // shackle
  for (const [lw, col] of [[s * 0.62, line], [s * 0.34, o.steel || '#dfe6ee']]) {
    ctx.lineWidth = lw; ctx.strokeStyle = col;
    ctx.beginPath(); ctx.moveTo(-s * 0.55, -s * 0.1); ctx.lineTo(-s * 0.55, -s * 0.55); ctx.arc(0, -s * 0.55, s * 0.55, Math.PI, 0); ctx.lineTo(s * 0.55, -s * 0.1); ctx.stroke();
  }
  // body
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  rr(-s, -s * 0.2, s * 2, s * 1.5, s * 0.34);
  const g = ctx.createLinearGradient(0, -s * 0.2, 0, s * 1.3);
  g.addColorStop(0, o.a || '#ffe07a'); g.addColorStop(1, o.b || '#e8950f');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = s * 0.16; ctx.strokeStyle = line; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = s * 0.12;
  ctx.beginPath(); ctx.moveTo(-s * 0.62, -s * 0.0); ctx.lineTo(s * 0.3, -s * 0.0); ctx.stroke();
  ctx.fillStyle = line;
  ctx.beginPath(); ctx.arc(0, s * 0.42, s * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s * 0.1, s * 0.5); ctx.lineTo(s * 0.1, s * 0.5); ctx.lineTo(s * 0.16, s * 0.98); ctx.lineTo(-s * 0.16, s * 0.98); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// A star with form: gold face lit from the top-left, darker lower facets, dark outline, a glint.
// Unfilled: a carved socket.
function starPath(ctx, r, k = 0.47) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * k : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}
export function drawStar(ctx, cx, cy, r, filled, t = 1, light = false) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(t, t);
  ctx.lineJoin = 'round';
  if (!filled) {
    starPath(ctx, r);
    ctx.lineWidth = r * 0.3;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.translate(0, r * 0.07); ctx.stroke(); ctx.translate(0, -r * 0.07);
    ctx.strokeStyle = light ? 'rgba(110,66,24,0.6)' : 'rgba(58,30,8,0.62)';
    ctx.stroke();
    ctx.fillStyle = light ? '#d2b07c' : '#6f4a26';
    ctx.fill();
    ctx.fillStyle = light ? 'rgba(110,66,24,0.22)' : 'rgba(30,12,0,0.3)';
    starPath(ctx, r * 0.6);
    ctx.fill();
    ctx.restore();
    return;
  }
  // outline (fat, rounds the points) and a drop edge
  starPath(ctx, r);
  ctx.lineWidth = r * 0.36;
  ctx.strokeStyle = '#7a3f04';
  ctx.translate(0, r * 0.1); ctx.stroke(); ctx.translate(0, -r * 0.1);
  ctx.stroke();
  const g = ctx.createLinearGradient(-r * 0.4, -r, r * 0.4, r);
  g.addColorStop(0, '#fff3a0');
  g.addColorStop(0.45, '#ffd034');
  g.addColorStop(1, '#f59a12');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#ffcf3a';
  ctx.lineWidth = r * 0.1;
  ctx.fill();
  ctx.stroke();
  // lower-right facets a step darker
  ctx.save();
  starPath(ctx, r);
  ctx.clip();
  ctx.fillStyle = 'rgba(214,110,0,0.38)';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5, b = a + Math.PI / 5;
    ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1); ctx.lineTo(Math.cos(b) * r * 0.6, Math.sin(b) * r * 0.6); ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
  // glint
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.3, r * 0.16, r * 0.08, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Small egg icon for HUD trays. state: 'alive' | 'saved' | 'broken' | 'empty'
export function drawEggIcon(ctx, cx, cy, s, state, cracks = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const h = s, w = s * 0.78;
  const path = () => {
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
  };
  path();
  if (state === 'slot') { // an egg-shaped hole on a cream card
    ctx.fillStyle = 'rgba(96,56,16,0.32)';
    ctx.fill();
    ctx.setLineDash([s * 0.14, s * 0.14]);
    ctx.strokeStyle = 'rgba(96,56,16,0.75)';
    ctx.lineWidth = Math.max(1.5, s * 0.07);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (state === 'empty') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.setLineDash([s * 0.14, s * 0.14]);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(1.5, s * 0.07);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (state === 'broken') {
    ctx.fillStyle = 'rgba(60,20,12,0.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,140,120,0.55)';
    ctx.lineWidth = Math.max(1.5, s * 0.07);
    ctx.stroke();
    ctx.strokeStyle = '#ff7a66';
    ctx.lineWidth = Math.max(2, s * 0.13);
    ctx.beginPath();
    ctx.moveTo(-w * 0.22, -h * 0.2); ctx.lineTo(w * 0.22, h * 0.2);
    ctx.moveTo(w * 0.22, -h * 0.2); ctx.lineTo(-w * 0.22, h * 0.2);
    ctx.stroke();
  } else {
    const saved = state === 'saved';
    const g = ctx.createRadialGradient(-w * 0.16, -h * 0.2, s * 0.04, 0, 0, h * 0.62);
    g.addColorStop(0, '#fffdf2');
    g.addColorStop(0.55, saved ? '#fff1cc' : '#fff4dc');
    g.addColorStop(1, saved ? '#eac586' : '#e3c796');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#5a3414';
    ctx.lineWidth = Math.max(1.5, s * 0.085);
    ctx.stroke();
    if (cracks > 0) {
      ctx.strokeStyle = '#6b4a20';
      ctx.lineWidth = Math.max(1.2, s * 0.06);
      ctx.beginPath();
      ctx.moveTo(-w * 0.3, h * 0.05);
      ctx.lineTo(-w * 0.05, -h * 0.05);
      ctx.lineTo(w * 0.1, h * 0.1);
      ctx.stroke();
    }
    if (saved) {
      // a green tick badge at the bottom right
      const br = s * 0.27, bx = w * 0.3, by = h * 0.26;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = '#3fb62e'; ctx.fill();
      ctx.lineWidth = Math.max(1.2, s * 0.06); ctx.strokeStyle = '#134f0f'; ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, s * 0.085);
      ctx.beginPath(); ctx.moveTo(bx - br * 0.45, by); ctx.lineTo(bx - br * 0.1, by + br * 0.35); ctx.lineTo(bx + br * 0.5, by - br * 0.35); ctx.stroke();
    }
  }
  ctx.restore();
}
