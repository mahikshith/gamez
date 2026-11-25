// 0.8.17 THE LANDING (mykee, 2026-11-25: "whenever a reward pops up that is related to coins ... the coins just animate
// and go back into the background. We are not showing the count on the screen ... especially during celebratory
// screens"). Every reward page (YOU GOT!, the boss treasure, the win page's reveals, the free-coins video) lands its
// prize the same way, ON the page:
//   - the gold purse chip (the map header's look) sits top right in the safe area, over the dim, from the first frame,
//     with the count BEFORE the reward;
//   - the coins fly from the prize to it in short eased arcs, one after another; each one that lands ticks the number up,
//     bumps the chip and lights a glint on its coin, and a "+N" rises under it; the count ends exactly on the new total;
//   - things that are not coins (a booster, a Chick Charge, an egg or an outfit) fly to a chip beside the purse (the bag,
//     or the shop for looks), which then shows the thing and how many there are now;
//   - busy() is true until all of it has landed: the page holds its close; finish() (a tap) lands it all at once.
// Calm: nothing flies; the number still counts up (0.6 s) and the things appear on their chip.
//
//   const land = createLanding({ clock, calm, sound, buzz, hold, release });
//   land.start({ from, to, src: { x, y }, items: [{ art, src, n?, dest: 'bag' | 'shop', size?, draw? }], delay?, wait? })
//   land.go(src?)              // a landing started with wait: true sets off (a reveal's claim)
//   land.draw(ctx, u, A, kit)  // once a frame, after the page (over its dim). kit: { ui, coin(ctx, x, y, r, t),
//                              //   art(ctx, art, x, y, size, t), bag(ctx, x, y, s, bump), shop(ctx, x, y, s) }
//   land.busy() / land.finish() / land.active() / land.shown() / land.clear() / land.state (QA)

import { rays, glow, burst, confetti, sparkleRing } from '../render/celebrate.js';

const STAG = 0.075, FLY = 0.55, ROLL = 0.1, BUMP = 0.2, I_FLY = 0.6, I_STAG = 0.14, CALM_ROLL = 0.6;
const smooth = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const easeOut = (k) => 1 - (1 - Math.max(0, Math.min(1, k))) ** 3;
const backOut = (k) => { const x = Math.max(0, Math.min(1, k)); return x <= 0 ? 0 : 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2; };
export const coinsFor = (amount) => Math.max(4, Math.min(12, Math.round(3 + Math.log2(Math.max(1, amount)))));

export function createLanding(env) {
  let L = null;
  const now = () => env.clock();
  // the plan: when each coin and each thing lands (s after t0)
  function plan(o) {
    const calm = env.calm(), amt = Math.max(0, Math.round((o.to ?? 0) - (o.from ?? 0))), n = amt > 0 ? (calm ? 1 : coinsFor(amt)) : 0;
    const coins = [];
    for (let i = 0; i < n; i++) coins.push({ dep: calm ? 0 : i * STAG, land: calm ? CALM_ROLL : i * STAG + FLY, heard: false });
    const c0 = n ? 0.1 : 0; // things leave just after the first coins
    const items = (o.items || []).slice(0, 4).map((it, j) => ({ ...it, dep: c0 + j * I_STAG, land: calm ? 0.3 : c0 + j * I_STAG + I_FLY, heard: false }));
    const end = Math.max(0, ...coins.map((c) => c.land + (calm ? 0 : ROLL)), ...items.map((q) => q.land));
    return { from: Math.round(o.from ?? 0), to: Math.round(o.to ?? o.from ?? 0), amt, src: o.src || null, coins, items, end, t0: o.wait ? Infinity : now() + (o.delay || 0), born: now(), calm, done: false, fin: false, lastLand: -9, finalAt: null };
  }
  const rel = () => (L ? (L.done ? 1e3 : L.t0 === Infinity ? -1e3 : now() - L.t0) : 0);
  function shownAt(r) {
    if (!L) return 0;
    if (L.done || r >= L.end) return L.to;
    if (!L.coins.length) return L.from;
    if (L.calm) return Math.round(L.from + L.amt * easeOut(r / CALM_ROLL));
    let f = 0;
    for (const c of L.coins) f += Math.max(0, Math.min(1, (r - c.land) / ROLL));
    return Math.min(L.to, Math.round(L.from + (L.amt * f) / L.coins.length));
  }
  const api = {
    start(o = {}) { L = plan(o); if (env.hold) env.hold(L.from); return L; },
    // a landing started with { wait: true } (its chips on the page, nothing flying yet) sets off now (src: a new start point)
    go(src) { if (!L || L.t0 !== Infinity) return; L.t0 = now(); if (src) L.src = src; },
    clear() { if (L && !L.freed && env.release) env.release(); L = null; },
    active() { return !!L; },
    // the page waits for this before it may close (a tap calls finish first)
    busy() { return !!L && !L.done && (L.amt > 0 || L.items.length > 0) && rel() < L.end; },
    finish() {
      if (!L || L.done) return;
      const r = rel(), quiet = r >= L.end;
      L.done = true; L.finalAt = now();
      if (!quiet) { env.sound('hud_pop', { vol: 0.8 }); if (env.buzz) env.buzz('tick'); }
    },
    shown() { return L ? shownAt(rel()) : null; },
    get state() { return L ? { from: L.from, to: L.to, shown: shownAt(rel()), busy: api.busy(), coins: L.coins.length, items: L.items.length, end: L.end, rel: rel() } : null; },
    draw(ctx, u, A, kit) {
      if (!L) return;
      const ui = kit.ui, t = now(), r = rel(), calm = L.calm, val = shownAt(r);
      // every other counter (under the dim, the shop's balance) says the same number while the coins land, then lets go
      if (api.busy()) { if (env.hold) env.hold(val); } else if (!L.freed) { L.freed = true; if (env.release) env.release(); }
      // ---- the sounds: one tick per coin that lands, rising; the last one pops
      if (!L.done) {
        L.coins.forEach((c, i) => {
          if (c.heard || r < c.land) return;
          c.heard = true; L.lastLand = t;
          if (i === L.coins.length - 1) { env.sound('hud_pop', { vol: 0.85 }); if (env.buzz) env.buzz('tick'); L.finalAt = t; }
          else env.sound('score_tick', { vol: 0.42, pitch: 1 + (0.7 * i) / Math.max(1, L.coins.length - 1) });
        });
        if (calm && L.coins.length && !L.coins[0].heard) { /* (calm: the one pop above) */ }
        L.items.forEach((q) => { if (!q.heard && r >= q.land) { q.heard = true; q.at = t; env.sound('hud_pop', { vol: 0.55, pitch: 1.3 }); if (env.buzz) env.buzz('tick'); } });
      }
      if (L.done && L.finalAt == null) L.finalAt = t;
      // ---- the purse chip: the map header's gold coin button, top right in the safe area
      const fs = 20 * u, h = 46 * u, digits = String(Math.max(L.from, L.to)).replace(/\d/g, '0');
      const w = Math.max(104 * u, ui.measure(digits, fs) + 66 * u), x = A.x1 - 10 * u - w, y = A.y + 8 * u;
      const pin = calm ? 1 : backOut((t - L.born) / 0.22); // (it is there from the first frame: a quick settle, never a slide)
      let bump = 0;
      if (!calm) { const q = (t - L.lastLand) / BUMP; if (q >= 0 && q < 1) bump = 0.09 * Math.sin(q * Math.PI); if (L.finalAt != null) { const z = (t - L.finalAt) / 0.32; if (z >= 0 && z < 1) bump = Math.max(bump, 0.2 * Math.sin(z * Math.PI)); } }
      const sc = Math.max(0.6, pin) * (1 + bump), pcx = x + w / 2, pcy = y + h / 2;
      let coinAt = { x: x + 28 * u, y: pcy };
      ctx.save(); ctx.translate(pcx, pcy); ctx.scale(sc, sc); ctx.translate(-pcx, -pcy);
      const b0 = ui.buttons.length;
      ui.button('land:purse', String(val), x, y, w, h, { kind: 'gold', size: fs, icon: (c, X, Y, S) => { kit.coin(c, X, Y, S * 0.56, t); coinAt = { x: pcx + (X - pcx) * sc, y: pcy + (Y - pcy) * sc }; } });
      ui.buttons.length = b0; // a picture of the purse, not a way into the shop (the page's own tap lands everything)
      // the glint: a four-point star on its coin as each one lands, and a light that sweeps the chip on the last
      const lq = (t - L.lastLand) / 0.3;
      if (!calm && lq >= 0 && lq < 1) star(ctx, coinAt.x + 7 * u, coinAt.y - 8 * u, 9 * u * Math.sin(lq * Math.PI));
      if (!calm && L.finalAt != null) { const z = (t - L.finalAt) / 0.45; if (z >= 0 && z < 1) sweep(ctx, ui, x, y, w, h - 5 * u, z); }
      ctx.restore();
      // "+N" rises under the purse from the first landing, and fades a second after the count has ended
      if (L.amt > 0) {
        const first = L.coins[0], k = L.done ? 1 : calm ? Math.min(1, r / 0.25) : Math.max(0, Math.min(1, (r - first.land) / 0.35));
        const fade = L.finalAt != null ? Math.max(0, Math.min(1, 1 - (t - L.finalAt - 1.1) / 0.4)) : 1;
        if (k > 0 && fade > 0) {
          const ps = 21 * u, py = y + h + 20 * u - 6 * u * easeOut(k) - 6 * u * (1 - fade), pk = calm ? 1 : backOut(k * 1.4);
          ctx.save(); ctx.globalAlpha = Math.min(1, k * 2) * fade; ctx.translate(pcx, py); ctx.scale(pk, pk);
          ui.text('+' + L.amt, 0, 0, { size: ps, align: 'center', color: '#ffe27a', stroke: 'rgba(60,28,6,0.95)', strokeW: 4.5 * u, noRecord: true });
          ctx.restore();
          ui.record({ x: pcx - ui.measure('+' + L.amt, ps) / 2, y: py - ps * 0.6, w: ui.measure('+' + L.amt, ps), h: ps * 1.2 }, 'land:plus');
        }
      }
      // ---- the chips for things: the bag (boosters, charges) and the shop (eggs, outfits), left of the purse
      const dests = [...new Set(L.items.map((q) => q.dest || 'bag'))];
      let right = x - 8 * u;
      const at = {};
      for (const d of dests) {
        const mine = L.items.filter((q) => (q.dest || 'bag') === d), landed = mine.filter((q) => L.done || r >= q.land);
        const is = 26 * u, cell = (q) => is + (q.n != null ? ui.measure('×' + q.n, 16 * u) + 4 * u : 0) + 6 * u;
        const cw = 10 * u + 30 * u + 4 * u + landed.reduce((s, q) => s + cell(q), 0) + 6 * u, cx0 = right - cw;
        let ib = 0;
        if (!calm) for (const q of landed) { const z = (t - (q.at ?? -9)) / BUMP; if (z >= 0 && z < 1) ib = Math.max(ib, Math.sin(z * Math.PI)); }
        const ccx = cx0 + cw / 2, isc = (calm ? 1 : Math.max(0.6, pin)) * (1 + 0.1 * ib);
        ctx.save(); ctx.translate(ccx, pcy); ctx.scale(isc, isc); ctx.translate(-ccx, -pcy);
        const b1 = ui.buttons.length;
        ui.button('land:' + d, '', cx0, y, cw, h, { kind: 'tertiary', round: h * 0.42 });
        ui.buttons.length = b1;
        const iy = pcy - 2.5 * u, hx = cx0 + 10 * u + 15 * u;
        if (d === 'shop') kit.shop(ctx, hx, iy, 30 * u); else kit.bag(ctx, hx, iy - 2 * u, 30 * u, ib);
        let px = cx0 + 10 * u + 30 * u + 4 * u;
        for (const q of landed) {
          const z = calm || L.done ? 1 : backOut((t - (q.at ?? t)) / 0.25);
          ctx.save(); ctx.translate(px + is / 2, iy); ctx.scale(z, z); if (q.draw) q.draw(ctx, 0, 0, is, t); else kit.art(ctx, q.art, 0, 0, is, t); ctx.restore();
          if (q.n != null) ui.text('×' + q.n, px + is + 2 * u, iy + 1 * u, { size: 16 * u, color: '#5a2c08', noRecord: true });
          px += cell(q);
        }
        ctx.restore();
        at[d] = { x: hx, y: iy };
        right = cx0 - 8 * u;
      }
      // ---- the flights, over everything: coins in short arcs (staggered, eased), then the things
      if (!calm && !L.done) {
        if (L.src) L.coins.forEach((c, i) => {
          const q = (r - c.dep) / FLY;
          if (q <= 0 || q >= 1) return;
          const e = smooth(q), sx = L.src.x + Math.sin(i * 2.4) * 12 * u, sy = L.src.y + Math.cos(i * 1.7) * 8 * u;
          const fx = sx + (coinAt.x - sx) * e, fy = sy + (coinAt.y - sy) * e - Math.sin(q * Math.PI) * (60 + 22 * (i % 3)) * u;
          kit.coin(ctx, fx, fy, (13 - 4 * q) * u, t * 3 + i);
        });
        L.items.forEach((q, j) => {
          const k = (r - q.dep) / I_FLY, to = at[q.dest || 'bag'];
          if (k <= 0 || k >= 1 || !q.src || !to) return;
          const e = smooth(k), fx = q.src.x + (to.x - q.src.x) * e, fy = q.src.y + (to.y - q.src.y) * e - Math.sin(k * Math.PI) * (70 + 20 * j) * u;
          const z0 = q.size || 54 * u, s = 1 - (1 - 26 * u / z0) * e; // from its size on the page to its size on the chip
          ctx.save(); ctx.translate(fx, fy); ctx.rotate((j % 2 ? 1 : -1) * Math.sin(e * Math.PI) * 0.5); ctx.scale(s, s);
          if (q.draw) q.draw(ctx, 0, 0, z0, t); else kit.art(ctx, q.art, 0, 0, z0, t); ctx.restore();
        });
      }
    },
  };
  return api;
}

function star(ctx, x, y, g) {
  if (g <= 0.3) return;
  ctx.save(); ctx.fillStyle = '#fffbe0';
  ctx.beginPath(); ctx.moveTo(x, y - g); ctx.quadraticCurveTo(x, y, x + g, y); ctx.quadraticCurveTo(x, y, x, y + g); ctx.quadraticCurveTo(x, y, x - g, y); ctx.quadraticCurveTo(x, y, x, y - g); ctx.fill();
  ctx.restore();
}
function sweep(ctx, ui, x, y, w, h, k) {
  ctx.save(); ui.roundRect(x, y, w, h, Math.min(15 * ui.u, h * 0.34)); ctx.clip();
  const sx = x - h + (w + 2 * h) * easeOut(k);
  ctx.fillStyle = `rgba(255,255,255,${(0.55 * Math.sin(k * Math.PI)).toFixed(3)})`;
  ctx.beginPath(); ctx.moveTo(sx, y + h); ctx.lineTo(sx + h * 0.55, y); ctx.lineTo(sx + h * 1.0, y); ctx.lineTo(sx + h * 0.45, y + h); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---- THE PRIZE POP (0.8.17, mykee: "right after the reward ads we are not actually showing the user whether they got
// the reward or not" ... "make it like a celebration kind of thing"): after a video for something that is not coins (a
// booster, a rewind, a hint, a farm friend, a skip), a small celebration: rays turn and a burst of light and confetti go
// off behind the prize, which pops in with an overshoot under its name, the hen cheers beside it, then it flies to where
// it is used (the PLAY button, the clock, the ally button) and lands with a flash. 1.2 to 1.6 s by the prize's weight
// (w 0..1); a tap (skip) sends it on its way at once. Over a level that is running (live) it is smaller, higher, and
// does not dim the board. Calm: no rays turning, no confetti, a steady glow. A video closed early or that never came:
// no party, the sad hen and one line ("No reward this time").
//   const pop = createPrizePop({ clock, calm, sound, buzz });
//   pop.start({ art: (ctx, x, y, size, t) => ..., name, to?: () => ({ x, y }) | null, w?: 0..1, live?, sad? })
//   pop.draw(ctx, u, A, kit)   // kit: { ui, sadHen(ctx, x, y, h, t), hen(ctx, x, y, h, t), dim(a) }
//   pop.skip()                 // a tap: straight to its flight
const POP_IN = 0.32, POP_FLY = 0.42, SAD_LEN = 2.4;
export function createPrizePop(env) {
  let P = null;
  const now = () => env.clock();
  const hold = (p) => 0.5 + 0.35 * p.w; // 1.24 .. 1.59 s in all
  return {
    start(o) {
      P = { w: 0.4, ...o, t0: now(), landed: false };
      if (o.sad) env.sound('cluck', { pitch: 0.7, vol: 0.55 });
      else { env.sound(P.w >= 0.6 ? 'tada' : 'unlock', { intensity: P.w }); if (!env.calm()) env.sound('confetti', { vol: 0.4 + 0.4 * P.w }); if (env.buzz) env.buzz(P.w >= 0.6 ? 'win' : 'tick'); }
    },
    clear() { P = null; },
    skip() { if (P && !P.sad) { const fly = POP_IN + hold(P); if (now() - P.t0 < fly) P.t0 = now() - fly; } },
    active() { return !!P; },
    get state() { return P ? { name: P.name, sad: !!P.sad, t: now() - P.t0, w: P.w } : null; },
    draw(ctx, u, A, kit) {
      if (!P) return;
      const ui = kit.ui, t = now() - P.t0, calm = env.calm(), live = !!P.live;
      const S = Math.min(A.w * (live ? 0.36 : 0.5), A.h * (live ? 0.2 : 0.26), (live ? 150 : 220) * u), cx = A.cx, cy = A.y + A.h * (live ? 0.3 : 0.42);
      if (P.sad) { // the hen, sad, on a small card with the line (quiet: no party)
        const a = Math.min(1, t / 0.2, (SAD_LEN - t) / 0.3);
        if (a <= 0) { P = null; return; }
        const ts = 21 * u, line = P.name || 'No reward this time', tw = ui.measure(line, ts), hh = 74 * u, cw = Math.min(A.w - 24 * u, tw + hh + 44 * u), ch = 92 * u, x = cx - cw / 2, y = cy - ch / 2;
        const k = calm ? 1 : backOut(t / 0.3);
        ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
        ui.panel(x, y, cw, ch, { r: 22 * u });
        kit.sadHen(ctx, x + 16 * u + hh / 2, cy + 4 * u, hh, now());
        ui.text(line, x + 26 * u + hh, cy, { size: ts, color: '#fff6dc', maxW: cw - hh - 36 * u, noRecord: true });
        ctx.restore();
        ui.record({ x, y, w: cw, h: ch }, 'pop:sad');
        return;
      }
      const flyAt = POP_IN + hold(P), end = flyAt + POP_FLY, to = P.to ? P.to() : null;
      if (t > end + 0.4) { P = null; return; }
      const fl = calm ? (t >= flyAt ? 1 : 0) : smooth((t - flyAt) / POP_FLY), party = 1 - fl; // the party fades as it leaves
      // the backdrop: the page dims a little (not over a running level), then the light
      if (!live && kit.dim) kit.dim(0.45 * Math.min(1, t / 0.15) * party);
      if (party > 0) {
        ctx.save(); ctx.globalAlpha = party * Math.min(1, t / 0.12);
        const R = S * (1.25 + 0.35 * P.w);
        rays(ctx, cx, cy, R, calm ? 0.2 : t * 0.5, 'rgba(255,226,140,0.24)', 14);
        if (!calm) rays(ctx, cx, cy, R * 0.75, -t * 0.8, 'rgba(255,248,210,0.14)', 9, 0.3);
        glow(ctx, cx, cy, S * (0.9 + 0.2 * P.w));
        ctx.restore();
        if (!calm) {
          const b = (t - 0.14) / 0.55; if (b > 0 && b < 1) { ctx.save(); ctx.globalAlpha = 0.6; burst(ctx, cx, cy, S * (0.6 + 0.3 * P.w), b); ctx.restore(); }
          confetti(ctx, cx, cy, t - 0.08, { n: Math.round(16 + 34 * P.w), speed: S * (2.2 + P.w), g: S * 2.2, life: 1.5, seed: (P.t0 * 7) % 97, size: Math.max(5, S * 0.045) });
        }
      }
      if (t >= end) { // landed: a flash where it went
        const q = (t - end) / 0.4, p = to || { x: cx, y: cy - S * 0.9 };
        if (!P.landed) { P.landed = true; env.sound('hud_pop', { vol: 0.8, pitch: 1.2 }); if (env.buzz) env.buzz('tick'); }
        ctx.save(); ctx.globalAlpha = 1 - q; ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 5 * u * (1 - q);
        ctx.beginPath(); ctx.arc(p.x, p.y, (12 + 34 * q) * u, 0, 7); ctx.stroke(); ctx.restore();
        if (!calm) sparkStar(ctx, p.x, p.y, 16 * u * Math.sin(Math.min(1, q * 1.5) * Math.PI));
        return;
      }
      // the hen cheers beside it while it is big (not over a running level: hers is the board's)
      if (!live && kit.hen && fl < 0.6) {
        const hk = calm ? 1 : backOut((t - 0.12) / 0.35), hh = S * 0.62;
        if (hk > 0.01) { ctx.save(); ctx.globalAlpha = 1 - fl / 0.6; const hx = cx - S * 0.78, hy = cy + S * 0.3; ctx.translate(hx, hy + hh * 0.5); ctx.scale(hk, hk); ctx.translate(-hx, -(hy + hh * 0.5)); kit.hen(ctx, hx, hy, hh, now()); ctx.restore(); }
      }
      // the prize: pops in with an overshoot, bobs while it shows, then flies in an arc to where it is used
      const inK = calm ? 1 : backOut(t / POP_IN);
      let x = cx, y = cy + (calm || fl > 0 ? 0 : Math.sin(t * 5) * S * 0.02), sc = inK;
      if (fl > 0) {
        const p = to || { x: cx, y: cy - S * 0.9 };
        x = cx + (p.x - cx) * fl; y = cy + (p.y - cy) * fl - Math.sin(fl * Math.PI) * S * 0.35; sc = 1 - 0.75 * fl;
      }
      ctx.save(); if (fl > 0 && !to) ctx.globalAlpha = 1 - fl;
      ctx.translate(x, y); ctx.scale(sc, sc); if (!calm && fl > 0) ctx.rotate(Math.sin(fl * Math.PI) * 0.4);
      P.art(ctx, 0, 0, S * 0.8, now()); ctx.restore();
      if (!calm && fl <= 0 && t > POP_IN) sparkleRing(ctx, cx, cy, S * 0.55, S * 0.48, now(), 8, S * 0.06);
      if (fl < 0.25 && t > POP_IN * 0.5) { // its name on a ribbon under it
        const ns = Math.min((live ? 24 : 28) * u, S * 0.17), rw = Math.min(A.w - 40 * u, ui.measure(P.name, ns) + 64 * u), rh = ns * 1.65, ny = cy + S * 0.56, k = calm ? 1 : backOut((t - POP_IN * 0.5) / 0.25);
        ctx.save(); ctx.globalAlpha = 1 - fl * 4; ctx.translate(cx, ny); ctx.scale(k, k); ctx.translate(-cx, -ny);
        ui.ribbon(P.name, cx, ny - rh / 2, rw, rh, { color: '#d89a1c', size: ns, noRecord: true });
        ctx.restore();
        ui.record({ x: cx - rw / 2, y: ny - rh / 2, w: rw, h: rh }, 'pop:name');
      }
    },
  };
}
function sparkStar(ctx, x, y, g) { star(ctx, x, y, g); }
