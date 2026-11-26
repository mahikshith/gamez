// 2026-11-23 (mykee: "whenever there is a doubling, or whenever there is an increment in the total number of coins, it is
// important that we should show some proper animation ... to give the user a euphoria"): ONE coin-gain effect for every
// place the purse grows. The saved wallet changes at once, as before; only the number on screen animates:
//   coins fly from where they came from (a button, a chest, the win card's tally) into the purse the player is looking at,
//   the purse rolls from the old total to the new one (eased, 0.6 to 1.2 s by the amount) with soft ticks that rise in
//   pitch, then a scale pop, a small burst, a "hud_pop" and a light buzz when it lands.
// Reduced motion: no flying coins, a quick 0.25 s roll and the pop only. Nothing here takes a tap or waits for one, and
// leaving the screen settles the number at once. No canvas is created: coins and bursts are drawn as plain paths.
//
//   const purse = createPurse({ clock, calm, wallet, screen, sound, buzz });
//   purse.gain({ src: { x, y }, from?, to?, delay?, dur? })   // after the wallet changed (dur: the roll's length, a page with its own beat)
//   purse.hold(v)          // show v (a total not yet "paid in" on screen) until a gain takes it on, or the screen changes
//   purse.release()        // drop a held total (a landing on a reward page is over: the counters show the purse)
//   purse.shown()          // the number every counter draws
//   purse.at({ x, y })     // a counter on screen says where its coin sits this frame (the flight's target)
//   purse.pop()            // the counter's scale this frame (1 = still)
//   purse.draw(ctx, u, area, drawCoin, ui)  // once a frame, last: the flying coins, the burst, and a floating purse
//                                           // when no counter of its own is on screen
//   purse.spend({ dst? })  // 0.8.17: coins were spent: the number counts DOWN from what was shown to the purse while coins
//                          // fly from the counter to dst (the thing bought: { x, y } or a function giving one), a soft
//                          // burst where they land. Any drop of the purse on the same screen counts down by itself (no
//                          // coins fly then); a page that knows what was bought calls spend with its dst first.

export const rollDur = (amount, calm) => (calm ? 0.25 : Math.min(1.2, Math.max(0.6, 0.6 + 0.2 * Math.log10(Math.max(1, amount)))));
export const flyN = (amount) => Math.max(4, Math.min(12, Math.round(3 + Math.log2(Math.max(1, amount)))));
const FLY = 0.46, POP = 0.32, STAGGER = 0.045, TICK = 0.065, LINGER = 0.9, DOWN = 0.7; // DOWN: a spend's count-down
const easeOut = (k) => 1 - (1 - k) ** 3;

export function createPurse(env) {
  let P = null, H = null, at = null, atFrame = -1, frame = 0, seen = null, seenScr = null, dstNext = null; // seen: the total on screen at the last frame (the "before" of a gain that names none)
  const now = () => env.clock();
  function settle() { P = null; H = null; }
  // done: a total still to come (the win card's coins after a boss treasure's) stays held until its own gain
  function finish() { const w = env.wallet(); H = P.part && P.to < w ? { v: P.to, scr: P.scr } : null; P = null; }
  // P's clock: t0 (start, after any delay), roll = when the number starts to move, end = roll + dur, pop after it
  function shownAt(t) {
    if (!P) { const w = env.wallet(), sc = env.screen(); return H ? H.v : seen != null && w < seen && seenScr === sc && sc !== 'play' ? seen : w; } // (a spend not yet counted: the old total until draw starts the count-down)
    if (t < P.t0 + P.roll) return P.from;
    const k = Math.min(1, (t - P.t0 - P.roll) / P.dur);
    return Math.round(P.from + (P.to - P.from) * easeOut(k));
  }
  function check() {
    const s = env.screen(), w = env.wallet();
    if (P && P.scr !== s) settle();
    if (H && H.scr !== s) H = null;
    if (P && w < P.to) { const cur = shownAt(now()); settle(); seen = cur; } // a spend while it rolls: it counts down from where it stood
    if (H && w < H.v) H = null;
  }
  // coins went out: count down from what the counters showed (from) to the purse, coins flying to dst
  function down(from, dst, to) {
    const w = env.wallet(), calm = env.calm(), end = Math.min(w, to != null ? to : w);
    if (!(from > end)) return false;
    const amt = from - end;
    P = { from, to: end, down: true, part: end < w, t0: now(), roll: 0, dur: calm ? 0.25 : DOWN, src: null, dst: calm ? null : dst || null, n: calm || !dst ? 0 : Math.max(3, Math.min(8, Math.round(2 + Math.log2(Math.max(1, amt)) * 0.8))), scr: env.screen(), lastTick: -1, landed: false, popAt: 0 };
    H = null;
    return true;
  }
  return {
    gain(o = {}) {
      check();
      const t = now(), w = env.wallet(), calm = env.calm();
      const cur = P || H ? shownAt(t) : null; // a roll already running (or a held total) goes on from where it stands
      const base = cur != null ? cur : seen != null ? Math.min(seen, w) : w;
      const from = Math.max(0, Math.round(o.from != null ? Math.min(o.from, base) : base));
      const to = Math.min(w, o.to != null ? o.to : w);
      if (to <= from) { if (!P) H = to < w ? { v: to, scr: env.screen() } : null; return false; }
      const amt = to - from, src = !calm && o.src ? o.src : null;
      P = { from, to, part: to < w, t0: t + (o.delay || 0), roll: src ? FLY * 0.8 : 0, dur: o.dur && !calm ? o.dur : rollDur(amt, calm), src, n: src ? flyN(amt) : 0, scr: env.screen(), lastTick: -1, landed: false, popAt: 0 };
      H = null;
      return true;
    },
    hold(v) {
      check();
      const sc = env.screen();
      if (!P && seen != null && seenScr === sc && sc !== 'play' && v < seen && env.wallet() < seen) { down(seen, dstNext, Math.round(v)); dstNext = null; return; } // coins went out first (a coin spin): count down to the held total
      if (!P) H = { v: Math.max(0, Math.round(v)), scr: sc };
    },
    spend(o = {}) {
      const t = now(), w = env.wallet();
      const from = P || H ? shownAt(t) : seen != null ? seen : w;
      if (P && !P.down) settle();
      if (from > w) return down(from, o.dst || null);
      dstNext = o.dst || null; // the wallet goes down after this call: the next frame takes it
      return false;
    },
    release() { H = null; }, // (0.8.17 ui/landing.js: a reward page held the counters while its coins landed)
    settle,
    active() { check(); return !!P; },
    held() { check(); return P || H ? shownAt(now()) : null; },
    shown() { check(); return shownAt(now()); },
    at(p) { at = p; atFrame = frame; },
    pop() {
      if (P && P.down) { const q = (now() - P.t0) / 0.3; return q >= 0 && q < 1 ? 1 - 0.1 * Math.sin(q * Math.PI) : 1; } // a spend: a small squeeze as the coins leave
      if (!P || !P.landed) return 1;
      const q = (now() - P.popAt) / POP;
      return q >= 1 || q < 0 ? 1 : 1 + 0.28 * Math.sin(q * Math.PI) * (1 - q * 0.4);
    },
    // QA: the running effect, for strips and tests
    get state() { return P ? { ...P, shown: shownAt(now()) } : H ? { hold: H.v } : null; },
    draw(ctx, u, A, drawCoin, ui) {
      frame++;
      check();
      { const w = env.wallet(), sc = env.screen(); // coins spent on this screen: the counters count down to the purse
        if (!P && !H && seen != null && w < seen && seenScr === sc && sc !== 'play') down(seen, dstNext);
        dstNext = null; seenScr = sc; }
      seen = P || H ? shownAt(now()) : env.wallet();
      if (!P) return;
      const t = now(), calm = env.calm(), rel = t - P.t0, mine = atFrame === frame - 1 && at; // a counter drawn this frame
      // the floating purse, top right, when the screen has no counter of its own (the win card, the fail card, a sheet)
      let tgt = mine ? at : null;
      if (!mine && rel > -0.25) {
        const end = P.roll + P.dur + POP + LINGER, a = Math.max(0, Math.min(1, (rel + 0.25) / 0.2, (end + 0.3 - rel) / 0.3));
        const val = String(shownAt(t)), fs = 20 * u, cr = 12 * u, h = 40 * u, w = 12 * u + cr * 2 + 8 * u + ui.measure(val.replace(/\d/g, '0'), fs) + 14 * u;
        const x = A.x1 - 12 * u - w, y = A.y + 8 * u, sc = this.pop();
        ctx.save(); ctx.globalAlpha = a;
        ctx.translate(x + w / 2, y + h / 2); ctx.scale(sc, sc); ctx.translate(-(x + w / 2), -(y + h / 2));
        ui.glass(x, y, w, h, { border: 'rgba(255,224,150,0.85)', a: 'rgba(54,30,10,0.92)', b: 'rgba(30,16,6,0.92)' });
        drawCoin(ctx, x + 10 * u + cr, y + h / 2, cr, t);
        ui.text(val, x + 10 * u + cr * 2 + 8 * u, y + h / 2, { size: fs, color: '#ffe27a', stroke: 'rgba(40,20,5,0.9)', strokeW: 3 * u, noRecord: true });
        ctx.restore();
        tgt = { x: x + 10 * u + cr, y: y + h / 2 };
        if (rel > end + 0.3) { finish(); return; }
      }
      if (rel < 0) return;
      if (P.down) { // a spend: coins leave the counter for the thing bought, the number ticks down, a burst where they land
        const d = typeof P.dst === 'function' ? P.dst() : P.dst, k = Math.min(1, rel / P.dur);
        if (tgt && d) for (let i = 0; i < P.n; i++) {
          const q = (rel - i * STAGGER) / FLY;
          if (q <= 0 || q >= 1) continue;
          const e = q * q * (3 - 2 * q), sx = tgt.x + Math.sin(i * 2.4) * 6 * u, sy = tgt.y + Math.cos(i * 1.7) * 4 * u;
          const x = sx + (d.x - sx) * e, y = sy + (d.y - sy) * e - Math.sin(q * Math.PI) * (40 + 14 * (i % 3)) * u;
          drawCoin(ctx, x, y, (10 - 2 * q) * u, t * 3 + i);
        }
        if (k < 1 && (P.lastTick < 0 || rel - P.lastTick >= TICK)) { P.lastTick = rel; env.sound('score_tick', { vol: 0.28, pitch: 1.5 - 0.6 * k }); }
        const endAt = Math.max(P.dur, d ? FLY + (P.n - 1) * STAGGER : 0);
        if (!P.landed && rel >= endAt) { P.landed = true; P.popAt = t; if (d) { env.sound('unlock', { vol: 0.7 }); env.buzz('tick'); } }
        if (P.landed && d) {
          const q = (t - P.popAt) / 0.5;
          if (q < 1) {
            ctx.save(); ctx.globalAlpha = 1 - q;
            ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 5 * u * (1 - q); ctx.beginPath(); ctx.arc(d.x, d.y, (12 + 34 * q) * u, 0, 7); ctx.stroke();
            if (!calm) { ctx.fillStyle = '#ffd94a'; for (let i = 0; i < 10; i++) { const a = i * 0.628 + 0.2, r = (16 + 36 * q) * u; ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r, 3 * u * (1 - q), 0, 7); ctx.fill(); } }
            ctx.restore();
          }
        }
        if (P.landed && (!d || t - P.popAt > 0.5) && (mine || rel > P.dur + LINGER)) finish();
        return;
      }
      // flying coins: from the source in an arc, one after another, into the counter's coin
      if (P.src && tgt) for (let i = 0; i < P.n; i++) {
        const q = (rel - i * STAGGER) / FLY;
        if (q <= 0 || q >= 1) continue;
        const e = q * q * (3 - 2 * q), sx = P.src.x + Math.sin(i * 2.4) * 10 * u, sy = P.src.y + Math.cos(i * 1.7) * 6 * u;
        const x = sx + (tgt.x - sx) * e, y = sy + (tgt.y - sy) * e - Math.sin(q * Math.PI) * (50 + 18 * (i % 3)) * u;
        drawCoin(ctx, x, y, (11 - 3 * q) * u, t * 3 + i);
      }
      // the roll's ticks, rising in pitch
      const k = Math.min(1, Math.max(0, (rel - P.roll) / P.dur));
      if (rel >= P.roll && k < 1 && (P.lastTick < 0 || rel - P.lastTick >= TICK)) { P.lastTick = rel; env.sound('score_tick', { vol: 0.32, pitch: 1 + 0.7 * k }); }
      if (!P.landed && k >= 1) { P.landed = true; P.popAt = t; env.sound('hud_pop', { vol: 0.8 }); env.buzz('tick'); }
      // the landing: a ring and a few sparks round the counter's coin
      if (P.landed && tgt) {
        const q = (t - P.popAt) / 0.45;
        if (q < 1) {
          ctx.save(); ctx.globalAlpha = 1 - q;
          ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 4 * u * (1 - q); ctx.beginPath(); ctx.arc(tgt.x, tgt.y, (10 + 26 * q) * u, 0, 7); ctx.stroke();
          if (!calm) { ctx.fillStyle = '#ffd94a'; for (let i = 0; i < 8; i++) { const a = i * 0.785 + 0.3, r = (14 + 30 * q) * u; ctx.beginPath(); ctx.arc(tgt.x + Math.cos(a) * r, tgt.y + Math.sin(a) * r, 2.6 * u * (1 - q), 0, 7); ctx.fill(); } }
          ctx.restore();
        }
      }
      if (P.landed && mine && t - P.popAt > POP + 0.1) finish();
    },
  };
}
