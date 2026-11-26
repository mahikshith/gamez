// Spend moments, the look (0.8.17, mykee: "come up with points or situations where users are more likely to spend coins
// and build proper animations"; "many users feel there are too many buttons"). ONE small family of short animations
// played on controls that are already on screen, so every moment feels the same: no new button, no popup, no words.
// The Brain (src/brain.js spendPick) picks the one moment of a screen visit; this module only draws it.
//
//   peek  the purse pulses, a coin hops from it into a bubble under the Shop button, the thing the coins reach rises
//         into the bubble, a green tick pops and its coin price shows (afford, fresh coins, today's deal)
//   walk  a new world's outfit walks in from the edge to the Shop button and the same bubble closes round it (world)
//   hop   the booster drops into its place and lands with a squash, a glint runs over it and a spark runs to what it
//         would have saved (the empty egg slot on a "So close" card), then its buy button shines (save, strip)
//   tag   a shine runs over a coin button and a little tag swings on its corner (streak, spin)
//   wave  the thing on a free try waves goodbye, then a "keep" tag with its coin price swings on it (keep)
// Each is under 1.5 s (FX_LEN). Any tap skips to the end state (a second tap lets it go), the end state stays HOLD s and
// fades; Calm shows the end state, still; on Low graphics the shines and shadows are left out. Nothing here takes a
// tap: the controls under it work as always.
//
//   const fx = createSpendFx({ clock, calm, low, sound, buzz });
//   fx.play({ id, kind, slot, key, price, was?, scr, seq, art?, tagArt?, walker? })
//   fx.at(name, rect)      // a control says where it is this frame: name is the slot, or slot + ':btn' / ':slot'
//   fx.k(slot)             // 0..1 (1: the end state), -1 when no moment runs on that slot
//   fx.hopXf(slot) / fx.waveXf(slot)   // what the control applies to its own picture: { dy, sx, sy, rot, a }
//   fx.skip()  fx.take()  fx.tick(screen, seq) -> the moment that just ended (or null)  fx.draw(ctx, kit)
export const FX_LEN = { peek: 1.35, walk: 1.45, hop: 1.3, tag: 1.2, wave: 1.4 };
export const HOLD = 2.4, FADE = 0.35;
const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = {
  out: (k) => 1 - (1 - cl(k)) ** 3,
  inOut: (k) => { k = cl(k); return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2; },
  back: (k) => { k = cl(k); const c = 1.70158; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; },
};
const ph = (el, a, b) => cl((el - a) / (b - a)); // the part of [a, b] gone by
const CUES = {
  peek: [[0, 'hud_pop', { vol: 0.45 }], [0.45, 'bubble_pop', { vol: 0.7 }], [0.95, 'star', { vol: 0.45, pitch: 1.3 }]],
  walk: [[0.05, 'hen_hop', { vol: 0.45 }], [0.95, 'bubble_pop', { vol: 0.7 }], [1.15, 'star', { vol: 0.45, pitch: 1.3 }]],
  hop: [[0.4, 'egg_bump', { vol: 0.6 }], [0.6, 'power_pickup', { vol: 0.4 }]],
  tag: [[0.05, 'power_pickup', { vol: 0.35 }], [0.35, 'ui_open', { vol: 0.45 }]],
  wave: [[0.05, 'cluck', { vol: 0.55, pitch: 1.35 }], [0.8, 'ui_open', { vol: 0.45 }]],
};

export function createSpendFx(env) {
  let M = null, frame = 0;
  const A = {}; // anchors: name -> { x, y, w, h, f (the frame it was set in) }
  const now = () => env.clock();
  const calm = () => !!env.calm();
  const el = () => (M ? (calm() ? M.len : Math.max(0, now() - M.t0)) : 0);
  function alpha() {
    if (!M) return 0;
    const end = M.fadeAt != null ? M.fadeAt : M.t0 + M.len + HOLD;
    return cl(1 - (now() - end) / FADE);
  }
  function anchor(name) { const r = A[name]; return r && r.f >= frame - 1 ? r : null; }
  const api = {
    play(m) {
      M = { ...m, len: FX_LEN[m.kind] || 1.2, t0: now(), fadeAt: null, taken: false, cues: (CUES[m.kind] || []).map((c) => ({ at: c[0], n: c[1], o: c[2], done: false })) };
      if (calm()) M.cues.forEach((c, i) => { c.done = i !== M.cues.length - 1; }); // Calm: one soft sound, the last
      if (m.buzz !== false && env.buzz) env.buzz('tap');
      return M;
    },
    get cur() { return M; },
    cheap: () => !!env.low(),
    on: (slot) => !!M && M.slot === slot && alpha() > 0,
    k(slot) { if (!M || (slot && M.slot !== slot)) return -1; return calm() ? 1 : cl(el() / M.len); },
    alpha,
    skip() { // a tap: the end state at once; a tap on the end state lets it go
      if (!M) return;
      if (!calm() && now() - M.t0 < M.len) { M.t0 = now() - M.len; M.cues.forEach((c) => { c.done = true; }); }
      else if (M.fadeAt == null) M.fadeAt = now();
    },
    take() { if (M) M.taken = true; },
    // the screen moved on, or the moment faded: it ends (the caller tells the Brain whether it was taken)
    tick(screen, seq) {
      if (!M) return null;
      if (M.scr !== screen || (M.seq != null && seq != null && M.seq !== seq) || alpha() <= 0) { const e = M; M = null; return e; }
      return null;
    },
    end() { const e = M; M = null; return e; },
    at(name, r) { if (r) A[name] = { x: r.x, y: r.y, w: r.w, h: r.h, f: frame }; },
    // the hop: the picture drops into place (gravity), lands with a squash, settles
    hopXf(slot) {
      const k = api.k(slot);
      if (k < 0 || calm() || M.kind !== 'hop') return null;
      const e = el(), p = e / 0.42;
      if (p < 1) return { dy: -1.3 * (1 - p * p), sx: 1, sy: 1.06, rot: 0, a: cl(p * 2.5) };
      const q = cl((e - 0.42) / 0.36);
      const sq = Math.sin(q * Math.PI) * (1 - q * 0.5) * 0.2;
      return { dy: 0, sx: 1 + sq, sy: 1 - sq, rot: 0, a: 1 };
    },
    // the goodbye wave: the picture rocks side to side, a little hop on each swing, and settles
    waveXf(slot) {
      const k = api.k(slot);
      if (k < 0 || calm() || M.kind !== 'wave') return null;
      const e = el(), env2 = e < 0.95 ? Math.sin(cl(e / 0.95) * Math.PI) : 0;
      return { dy: -Math.abs(Math.sin(e * 9)) * 0.09 * env2, sx: 1, sy: 1, rot: Math.sin(e * 9) * 0.42 * env2, a: 1 };
    },
    draw(ctx, kit) {
      frame++;
      if (!M) return;
      const e = el(), a = alpha();
      for (const c of M.cues) if (!c.done && e >= c.at) { c.done = true; env.sound(c.n, c.o); }
      if (a <= 0) return;
      ctx.save(); ctx.globalAlpha *= a;
      try {
        if (M.kind === 'peek' || M.kind === 'walk') drawPeek(ctx, kit, M, e, anchor(M.slot));
        else if (M.kind === 'hop') drawHop(ctx, kit, M, e, anchor(M.slot), anchor(M.slot + ':btn'), anchor(M.slot + ':slot'));
        else if (M.kind === 'tag') drawTagOn(ctx, kit, M, e, anchor(M.slot));
        else if (M.kind === 'wave') drawWave(ctx, kit, M, e, anchor(M.slot));
      } finally { ctx.restore(); }
    },
  };
  function low() { return !!env.low(); }
  // ---- peek / walk: a bubble under (or over) the Shop button with the thing in it
  function drawPeek(ctx, kit, m, e, B) {
    if (!B) return;
    const u = kit.u, Ar = kit.A, still = calm(), walk = m.kind === 'walk';
    const bs = Math.min(104 * u, Ar.w * 0.3), bh = bs * 1.14, below = B.y + B.h + 16 * u + bh < Ar.y1 - 90 * u;
    const bx = cl(B.x + B.w / 2 - bs / 2, Ar.x + 8 * u, Ar.x1 - 8 * u - bs), by = below ? B.y + B.h + 14 * u : B.y - 14 * u - bh;
    const cx = bx + bs / 2, cy = by + bh / 2, coinAt = { x: B.x + Math.min(B.h * 0.55, B.w * 0.25), y: B.y + B.h / 2 };
    const t0 = walk ? 0.9 : 0.45; // the bubble pops at t0
    // 1. the purse pulses (a gold ring off the button)
    if (!walk && !still && e < 0.55) { const q = ph(e, 0, 0.5); ctx.save(); ctx.globalAlpha *= 1 - q; ctx.lineWidth = 4 * u * (1 - q); ctx.strokeStyle = '#ffe27a'; kit.ui.roundRect(B.x - 8 * u * q, B.y - 8 * u * q, B.w + 16 * u * q, B.h + 16 * u * q, B.h / 2 + 8 * u * q); ctx.stroke(); ctx.restore(); }
    // 2. a coin hops from the purse to where the bubble opens (walk: the outfit walks in from the edge)
    if (!walk && !still && e > 0.12 && e < 0.58) {
      const q = ease.inOut(ph(e, 0.12, 0.56)), x = coinAt.x + (cx - coinAt.x) * q, y = coinAt.y + (cy - coinAt.y) * q - Math.sin(q * Math.PI) * 46 * u;
      kit.coin(ctx, x, y, (13 + 6 * Math.sin(q * Math.PI)) * u, kit.t * 3);
    }
    if (walk && !still && e < t0 + 0.05 && m.walker) {
      const q = ease.inOut(ph(e, 0, t0)), fromX = below ? Ar.x - 40 * u : Ar.x1 + 40 * u, x = fromX + (cx - fromX) * q, step = Math.abs(Math.sin(e * 14));
      ctx.save(); ctx.translate(x, cy + bh * 0.36 - step * 5 * u); ctx.rotate(Math.sin(e * 14) * 0.08); m.walker(ctx, 0, 0, bs * 0.78, kit.t, cx < fromX ? -1 : 1); ctx.restore();
    }
    // 3. the bubble pops open (back ease), its tail toward the button
    const pk = still ? 1 : ease.back(ph(e, t0, t0 + 0.32));
    if (pk <= 0.01) return;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(pk, pk); ctx.translate(-cx, -cy);
    const tx = cl(B.x + B.w / 2, bx + 22 * u, bx + bs - 22 * u), ty0 = below ? by : by + bh, dir = below ? -1 : 1;
    if (!low()) { kit.ui.roundRect(bx, by + 4 * u, bs, bh, 22 * u); ctx.fillStyle = 'rgba(30,14,4,0.32)'; ctx.fill(); }
    kit.ui.roundRect(bx, by, bs, bh, 22 * u);
    const g = ctx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#ffeec4');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3 * u; ctx.strokeStyle = m.id === 'deal' ? '#e8402e' : '#e0a020'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx - 10 * u, ty0 - dir); ctx.lineTo(tx, ty0 + dir * 12 * u); ctx.lineTo(tx + 10 * u, ty0 - dir); ctx.closePath(); ctx.fillStyle = below ? '#fffaf0' : '#ffeec4'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx - 10 * u, ty0); ctx.lineTo(tx, ty0 + dir * 12 * u); ctx.lineTo(tx + 10 * u, ty0); ctx.stroke();
    // 4. the thing rises into it (clipped to the bubble), with a soft sunburst behind it
    const rk = still ? 1 : ease.out(ph(e, t0 + 0.12, t0 + 0.5)), artH = bs * 0.62, artY = by + bh * 0.4 + (1 - rk) * bh * 0.5;
    ctx.save(); kit.ui.roundRect(bx + 3 * u, by + 3 * u, bs - 6 * u, bh - 6 * u, 19 * u); ctx.clip();
    if (!low()) { const rg = ctx.createRadialGradient(cx, by + bh * 0.4, 2, cx, by + bh * 0.4, bs * 0.5); rg.addColorStop(0, 'rgba(255,214,90,0.55)'); rg.addColorStop(1, 'rgba(255,214,90,0)'); ctx.fillStyle = rg; ctx.fillRect(bx, by, bs, bh); }
    if (walk && m.walker) m.walker(ctx, cx, artY + artH * 0.42, artH * 1.05, kit.t, 1);
    else if (m.art) m.art(ctx, cx, artY, artH, kit.t);
    ctx.restore();
    // 5. the price on a chip at the bubble's foot (today's deal: a red chip, the red "%" badge on the corner)
    const ck = still ? 1 : ease.back(ph(e, t0 + 0.45, t0 + 0.75));
    if (ck > 0.01 && m.price > 0) {
      const fs = 15 * u, chH = 24 * u, str = String(m.price), cw = chH + kit.ui.measure(str, fs) + 12 * u, chx = cx - cw / 2, chy = by + bh - chH - 7 * u;
      ctx.save(); ctx.translate(cx, chy + chH / 2); ctx.scale(ck, ck); ctx.translate(-cx, -(chy + chH / 2));
      kit.ui.roundRect(chx, chy, cw, chH, chH / 2); ctx.fillStyle = m.id === 'deal' ? '#d8301e' : '#3a2410'; ctx.fill();
      kit.coin(ctx, chx + chH * 0.52, chy + chH / 2, chH * 0.34, 0);
      kit.ui.text(str, chx + chH + 2 * u, chy + chH / 2 + 0.5 * u, { size: fs, color: '#ffe27a', maxW: cw - chH, noRecord: true });
      ctx.restore();
    }
    ctx.restore();
    // 6. the green tick: you can get it now (today's deal: a red "%" badge)
    const kk = still ? 1 : ph(e, t0 + 0.5, t0 + 0.8);
    if (kk > 0 && m.can !== false) badge(ctx, kit, bx + bs - 6 * u, by + 6 * u, 13 * u, kk, m.id === 'deal' ? 'deal' : 'tick');
  }
  // ---- hop: the booster lands (the control applies hopXf), a shine on it, a spark to what it would have saved, its button shines
  function drawHop(ctx, kit, m, e, I, Bt, S) {
    const u = kit.u, still = calm();
    if (I && !still && !low() && e > 0.45 && e < 0.9) glint(ctx, kit, I, ph(e, 0.45, 0.9), Math.min(I.w, I.h) * 0.22);
    if (I && S) { // the replay: a spark from the booster to the egg slot, then the slot glows gold as if the egg got home
      const q = still ? 1 : ease.inOut(ph(e, 0.55, 0.95)), ix = I.x + I.w / 2, iy = I.y + I.h / 2, sx = S.x + S.w / 2, sy = S.y + S.h / 2;
      if (q > 0 && q < 1) {
        const x = ix + (sx - ix) * q, y = iy + (sy - iy) * q - Math.sin(q * Math.PI) * 40 * u;
        if (!low()) for (let j = 1; j <= 6; j++) { const p = Math.max(0, q - j * 0.04), x2 = ix + (sx - ix) * p, y2 = iy + (sy - iy) * p - Math.sin(p * Math.PI) * 40 * u; ctx.save(); ctx.globalAlpha *= 0.75 - j * 0.1; ctx.beginPath(); ctx.arc(x2, y2, (8 - j) * u, 0, 7); ctx.fillStyle = '#ffd94a'; ctx.fill(); ctx.restore(); }
        star(ctx, x, y, 15 * u, kit.t * 6, '#fff3b0'); star(ctx, x, y, 8 * u, -kit.t * 4, '#ffd24a');
      }
      const gk = still ? 0.55 : ph(e, 0.92, 1.1) * (1 - 0.45 * ph(e, 1.1, 1.3));
      if (gk > 0) { ctx.save(); ctx.globalAlpha *= gk; ctx.lineWidth = 4 * u; ctx.strokeStyle = '#ffc828'; ctx.beginPath(); ctx.ellipse(sx, sy, S.w * 0.7, S.h * 0.7, 0, 0, 7); ctx.stroke(); if (!low()) { ctx.globalAlpha *= 0.5; ctx.fillStyle = '#ffe27a'; ctx.fill(); } ctx.restore();
        if (!still && e < 1.35) { const q2 = ph(e, 0.92, 1.35); ctx.save(); ctx.globalAlpha *= 1 - q2; ctx.lineWidth = 3 * u * (1 - q2); ctx.strokeStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(sx, sy, (10 + 26 * q2) * u, 0, 7); ctx.stroke(); ctx.restore(); } }
    }
    if (Bt && !still && !low() && e > 0.85) glint(ctx, kit, Bt, ph(e, 0.85, 1.3), Math.min(14 * u, Bt.h / 2));
    if (I && !Bt) rim(ctx, kit, I, e - 0.55, Math.min(16 * u, I.w * 0.26)); // the strip's tile: a gold rim pulses twice and stays (no tag: its price is on it)
  }
  // a gold rim round a control: two pulses out, then it stays lit (Calm: lit, still)
  function rim(ctx, kit, R, tt, r) {
    if (!calm() && tt <= 0) return;
    const u = kit.u, t = calm() ? 9 : tt;
    ctx.save();
    for (let i = 0; i < 2 && !calm(); i++) { const q = (t - i * 0.32) / 0.5; if (q <= 0 || q >= 1) continue; const g = 10 * u * ease.out(q); ctx.save(); ctx.globalAlpha *= 1 - q; ctx.lineWidth = 4 * u; ctx.strokeStyle = '#ffd24a'; kit.ui.roundRect(R.x - g, R.y - g, R.w + 2 * g, R.h + 2 * g, r + g); ctx.stroke(); ctx.restore(); }
    const a = cl(t / 0.25); ctx.globalAlpha *= a; ctx.lineWidth = 3.5 * u; ctx.strokeStyle = '#ffc828'; kit.ui.roundRect(R.x - 2 * u, R.y - 2 * u, R.w + 4 * u, R.h + 4 * u, r + 2 * u); ctx.stroke();
    ctx.restore();
  }
  // ---- tag: a shine over a coin button, a tag swinging on its corner
  function drawTagOn(ctx, kit, m, e, B) {
    if (!B) return;
    const u = kit.u;
    if (!calm() && !low() && e < 0.6) glint(ctx, kit, B, ph(e, 0, 0.55), Math.min(14 * u, B.h / 2));
    rim(ctx, kit, B, e - 0.25, Math.min(14 * u, B.h / 2));
    cornerBadge(ctx, kit, m, B.x + B.w - 12 * u, B.y + 3 * u, e - 0.35, Math.min(17 * u, B.h * 0.3));
  }
  // a round badge that pops on a button's corner and wobbles on its pin to rest (what the button is for: a flame, the machine)
  function cornerBadge(ctx, kit, m, x, y, tt, r) {
    if (!m.tagArt || (!calm() && tt <= 0)) return;
    const u = kit.u, t = calm() ? 9 : tt, k = calm() ? 1 : ease.back(cl(t / 0.28)), ang = calm() ? 0 : 0.5 * Math.exp(-3.6 * t) * Math.sin(11 * t);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(k, k);
    if (!low()) { ctx.beginPath(); ctx.arc(1.2 * u, 2.5 * u, r, 0, 7); ctx.fillStyle = 'rgba(30,14,4,0.35)'; ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#fffbe8'); g.addColorStop(1, '#ffe08a'); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2.5 * u; ctx.strokeStyle = '#d8901a'; ctx.stroke();
    m.tagArt(ctx, 0, 0, r * 1.35);
    ctx.restore();
  }
  // ---- wave: the control rocks its picture (waveXf); then the keep tag swings on it
  function drawWave(ctx, kit, m, e, B) {
    if (!B) return;
    swingTag(ctx, kit, m, B.x + B.w * 0.8, B.y + 6 * kit.u, e - 0.75, Math.min(42 * kit.u, B.h * 0.34));
  }
  // a tag on a string, pinned at (x, y): it drops in and swings to rest (Calm: hanging still)
  function swingTag(ctx, kit, m, x, y, tt, h) {
    if (!calm() && tt <= 0) return;
    const u = kit.u, t = calm() ? 9 : tt, k = calm() ? 1 : ease.back(cl(t / 0.22));
    const ang = calm() ? 0.12 : 0.12 + 0.6 * Math.exp(-3.4 * t) * Math.sin(10 * t);
    const fs = h * 0.5, str = m.price > 0 ? String(m.price) : '', cr = h * 0.27;
    const cw = m.tagArt ? h * 1.15 : 0, tw = Math.max(h * 1.2, (m.tagArt ? cw : 0) + (str ? cr * 2 + 4 * u + kit.ui.measure(str, fs) : 0) + 14 * u), L = h * 0.32;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(k, k);
    ctx.strokeStyle = '#7a4a14'; ctx.lineWidth = Math.max(1, 1.6 * u); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, L); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 2.6 * u, 0, 7); ctx.fillStyle = '#c88a20'; ctx.fill();
    ctx.translate(0, L);
    const hw = tw / 2, nh = h * 0.28; // a luggage tag: a point at the top, square shoulders, rounded foot
    const shape = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(hw, nh); ctx.lineTo(hw, h - 6 * u); ctx.quadraticCurveTo(hw, h, hw - 6 * u, h); ctx.lineTo(-hw + 6 * u, h); ctx.quadraticCurveTo(-hw, h, -hw, h - 6 * u); ctx.lineTo(-hw, nh); ctx.closePath(); };
    if (!low()) { ctx.save(); ctx.translate(1.5 * u, 3 * u); shape(); ctx.fillStyle = 'rgba(30,14,4,0.3)'; ctx.fill(); ctx.restore(); }
    shape(); const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fff6d6'); g.addColorStop(1, '#ffd978');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2 * u; ctx.strokeStyle = '#b8781a'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, nh * 0.75, 2.4 * u, 0, 7); ctx.fillStyle = '#7a4a14'; ctx.fill();
    let cx = -tw / 2 + 7 * u; const cy = nh + (h - nh) / 2;
    if (m.tagArt) { m.tagArt(ctx, cx + cw / 2, cy, h * 0.72); cx += cw; }
    if (str) { kit.coin(ctx, cx + cr, cy, cr, 0); kit.ui.text(str, cx + cr * 2 + 3 * u, cy + 0.5 * u, { size: fs, color: '#5a2c08', noRecord: true }); }
    ctx.restore();
  }
  function glint(ctx, kit, R, q, r) {
    if (q <= 0 || q >= 1) return;
    ctx.save(); kit.ui.roundRect(R.x, R.y, R.w, R.h, r); ctx.clip();
    const bw = Math.max(R.h * 1.2, 40), x = R.x - bw + (R.w + bw * 2) * ease.inOut(q);
    const g = ctx.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.translate(x, R.y + R.h / 2); ctx.transform(1, 0, -0.5, 1, 0, 0); ctx.fillRect(-bw / 2, -R.h, bw, R.h * 2);
    ctx.restore();
  }
  function badge(ctx, kit, x, y, r, q, kind) {
    const k = calm() ? 1 : ease.back(q);
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fillStyle = kind === 'deal' ? '#e8402e' : '#3eb42d'; ctx.fill(); ctx.lineWidth = 2.5 * kit.u; ctx.strokeStyle = '#fff'; ctx.stroke();
    if (kind === 'deal') kit.ui.text('%', 0, 0.5 * kit.u, { size: r * 1.3, align: 'center', color: '#fff', noRecord: true });
    else { // the check draws itself in
      const d = calm() ? 1 : cl((q - 0.3) / 0.7);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.28; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      const p0 = [-r * 0.45, 0], p1 = [-r * 0.1, r * 0.36], p2 = [r * 0.5, -r * 0.34];
      ctx.moveTo(p0[0], p0[1]);
      if (d < 0.4) { const f = d / 0.4; ctx.lineTo(p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f); } else { const f = (d - 0.4) / 0.6; ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p1[0] + (p2[0] - p1[0]) * f, p1[1] + (p2[1] - p1[1]) * f); }
      ctx.stroke();
    }
    ctx.restore();
  }
  return api;
}
// a four-point sparkle
function star(ctx, x, y, r, rot, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.32 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.restore();
}
