// 0.8.19 THE OPENING (mykee, 2026-11-27: "rather than a stale sky blue colour ... it should zoom into the logo, and then
// we could show 'Eggscape', and then the landing page ... a proper transition between the logo and the landing page").
// One unbroken move from the app's first picture into the first page, drawn OVER the page (which is laid out and live
// underneath the whole time, so nothing waits for it):
//   - frame 0 is exactly the page's first paint (src/index.template.html #splash) and Android's start window: the egg
//     from the icon, EGG_BOX px, centred on the sky gradient (SKY);
//   - the egg wobbles, light breaks out behind it, the camera pushes in with a little overshoot and the word drops in
//     letter by letter under it;
//   - a small pull back, then the push goes THROUGH the egg: a hole opens in it and the camera flies through, so the
//     page is revealed by the move itself. On the home page the word flies up and becomes the page's own title.
// Short form (a returning player): the same move in about 1 s. Calm: no wobble, no zoom, one gentle cross-dissolve.
// Low: no rays, no sparkles. A tap before the push-through starts it at once.
//
//   const op = createOpening({ img, clock, calm, low, short, sound, logo(ctx, cx, cy, size, enter) })
//   op.draw(ctx, W, H, logoAt)  // once a frame, over the page. logoAt { x, y, s }: the page's own title, or null
//   op.covers()                 // the page is still fully hidden (its own entrance should not start yet)
//   op.word()                   // the opening still draws the word (the page must not draw its title)
//   op.tap()                    // true: the tap was used (to skip)
//   op.done / op.state (QA)

import { rays, glow, sparkleRing } from '../render/celebrate.js';

export const SKY = [[0, '#428abe'], [0.3, '#6eb5e5'], [1, '#b8ddf3']]; // = #splash in the template = android splash_bg.xml
export const EGG_BOX = 242; // CSS px = dp: the icon's foreground picture (432 px), as the template and Android show it
const c01 = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);
const smooth = (k) => { k = c01(k); return k * k * (3 - 2 * k); };
const easeOut = (k) => 1 - (1 - c01(k)) ** 3;
const backOut = (k, c = 1.9) => { k = c01(k); return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; };

export function createOpening(env) {
  const calm = !!env.calm, low = !!env.low, short = !!env.short;
  // the beats (s): wobble, the word's first letter and its pace, the push in, the push through and how long it takes
  const B = calm ? { go: 0.55, len: 0.5 }
    : short ? { wob: 0.3, word: 0.08, pace: 2.6, in0: 0.1, in1: 0.5, zin: 0.3, go: 0.56, len: 0.46 }
      : { wob: 0.55, word: 0.5, pace: 1.45, in0: 0.38, in1: 1.0, zin: 0.55, go: 1.32, len: 0.6 };
  let t0 = null, done = false, heard = {}, len = B.len, wordFrom = null, skipped = false;
  const now = () => (t0 == null ? 0 : env.clock() - t0);
  const say = (k, name, o) => { if (!heard[k]) { heard[k] = 1; env.sound(name, o); } };
  const api = {
    get done() { return done; },
    covers() { return !done && now() < B.go; },
    word() { return !done && !calm; },
    tap() { if (done || t0 == null || now() >= B.go) return false; t0 = env.clock() - B.go; len = Math.min(len, 0.4); skipped = true; return true; },
    get state() { return { t: now(), go: B.go, len, done, short, calm }; },
    draw(ctx, W, H, logoAt) {
      if (done) return;
      if (t0 == null) t0 = env.clock();
      const t = now(), k = c01((t - B.go) / len);
      const S = Math.min(EGG_BOX, Math.min(W, H) * 0.8), cx = W / 2, cy = H / 2;
      const sky = () => { const g = ctx.createLinearGradient(0, 0, 0, H); for (const [p, c] of SKY) g.addColorStop(p, c); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
      const egg = (rot, sq) => {
        const py = cy + S * 0.34; // it rocks on its base
        ctx.save(); ctx.translate(cx, py); ctx.rotate(rot); ctx.scale(1 + sq, 1 - sq); ctx.translate(-cx, -py);
        if (env.img && env.img.naturalWidth) ctx.drawImage(env.img, cx - S / 2, cy - S / 2, S, S);
        ctx.restore();
      };
      if (calm) { // steady picture, the word whole under it, then one cross-dissolve into the page
        ctx.save(); ctx.globalAlpha = 1 - smooth(k);
        sky(); egg(0, 0);
        const cs = wordSize(W, H, S, 1); ctx.globalAlpha *= smooth(t / 0.3); env.logo(ctx, cx, cy + S * 0.36 + cs * 0.8, cs, 9); // (the word comes up softly: frame 0 is the first paint)
        ctx.restore();
        if (k >= 1) done = true;
        return;
      }
      // ---- the camera: in with an overshoot, a small pull back (anticipation), then through
      const zin = 1 + B.zin * backOut((t - B.in0) / (B.in1 - B.in0), 2.4);
      const pull = 1 - 0.05 * smooth((t - (B.go - 0.16)) / 0.16);
      // (a low screen: the egg rises as it grows, to keep room for the word under it)
      const ws = wordSize(W, H, S, 1 + B.zin), ey = cy - Math.max(0, S * 0.36 * (1 + B.zin) + ws * 1.8 - H / 2) * c01((zin - 1) / B.zin);
      const zEnd = Math.max(9, (Math.hypot(W, H) * 0.62) / (S * 0.27));
      const Z = zin * pull * Math.exp(Math.log(zEnd) * k ** 2.4);
      const hole = easeOut(k * 1.7), hx = S * 0.27 * hole * Z, hy = S * 0.31 * hole * Z, hcy = ey + S * 0.02 * Z;
      const wob = B.wob, we = t < wob ? Math.sin(Math.PI * t / wob) : 0;
      const rot = we * 0.12 * Math.sin(t * 21), sq = we * 0.035 * Math.sin(t * 42) + (k <= 0 ? 0.03 * (1 - pull) / 0.05 : 0);
      const light = smooth((t - wob * 0.45) / 0.4);
      const wy = ey + S * 0.36 * zin * pull + ws * 0.8, // (the word stands on the screen, under the egg as it grows)
         enter = skipped ? 9 : (t - B.word) * B.pace;
      ctx.save();
      if (k > 0) { ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.ellipse(cx, hcy, Math.max(0.01, hx), Math.max(0.01, hy), 0, 0, 7); ctx.clip('evenodd'); }
      sky();
      ctx.translate(cx, ey); ctx.scale(Z, Z); ctx.translate(-cx, -cy);
      if (light > 0) { // light breaks out behind the egg
        ctx.save(); ctx.globalAlpha = light;
        if (!low) { // soft beams that fade out with distance (no hard ends)
          const R = S * 2.6, g = ctx.createRadialGradient(0, 0, S * 0.2, 0, 0, R);
          g.addColorStop(0, 'rgba(255,250,215,0.5)'); g.addColorStop(0.45, 'rgba(255,246,200,0.2)'); g.addColorStop(1, 'rgba(255,246,200,0)');
          rays(ctx, cx, cy, R, t * 0.5, g, 12); rays(ctx, cx, cy, R * 0.7, -t * 0.8, g, 8, 0.3);
        }
        glow(ctx, cx, cy, S * 0.95, 0.95);
        ctx.restore();
      }
      egg(rot, sq);
      if (!low && light > 0.2 && k < 0.5) sparkleRing(ctx, cx, cy, S * 0.5, S * 0.46, t, 7, S * 0.045);
      ctx.restore();
      const hand = !!logoAt && k > 0; // the word flies to the page's title; with no title to go to it is left behind by the camera
      if (!hand) { ctx.save(); if (k > 0) { ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.ellipse(cx, hcy, Math.max(0.01, hx), Math.max(0.01, hy), 0, 0, 7); ctx.clip('evenodd'); } const zz = Z / (zin * pull); env.logo(ctx, cx, ey + (wy - ey) * zz, ws * zz, enter); ctx.restore(); }
      if (k > 0 && k < 1) { // the rim of the hole: light from the page side
        ctx.save(); ctx.globalAlpha = (1 - k) * 0.9;
        for (const [w, a] of [[0.2, 0.25], [0.1, 0.45], [0.035, 0.9]]) { ctx.strokeStyle = `rgba(255,250,220,${a})`; ctx.lineWidth = Math.max(2, hx * w); ctx.beginPath(); ctx.ellipse(cx, hcy, hx, hy, 0, 0, 7); ctx.stroke(); }
        ctx.restore();
      }
      let flown = true;
      if (hand) {
        if (!wordFrom) wordFrom = { x: cx, y: wy, s: ws };
        const q = c01((t - B.go) / Math.max(len, 0.5)), e = backOut(q, 1.2), m = (a, b) => a + (b - a) * e;
        env.logo(ctx, m(wordFrom.x, logoAt.x), m(wordFrom.y, logoAt.y), m(wordFrom.s, logoAt.s), 9);
        flown = q >= 1;
      }
      // ---- the sounds
      if (t > wob * 0.4) say('crack', 'egg_crack', { vol: 0.5 });
      if (!skipped) for (let i = 0; i < 8; i++) if (enter > i * 0.07 + 0.3) say('l' + i, 'score_tick', { vol: 0.3, pitch: 1 + i * 0.09 });
      if (k > 0) say('go', 'wind_gust', { vol: 0.5 });
      if (k >= 1 && flown) { done = true; if (hand) env.sound('hud_pop', { vol: 0.5 }); }
    },
  };
  return api;
}
// the word under the egg: as wide as the screen lets it be at the camera's closest (zMax), and clear of the bottom edge
function wordSize(W, H, S, zMax) {
  return Math.max(14, Math.min((W * 0.86) / 5.02, Math.max((H / 2 - S * 0.36 * zMax) / 1.5, H * 0.12), 80));
}
