// Wonder Vaults controller (bonus world): its own screen ('wonder') with its own loop, camera, input, HUD and end
// cards, so the five mechanics never touch the campaign's update/render path. Also draws the Extras menu screen
// (Wonder Vaults in every build; the Practice lab pages where the build has them).
// Physics: sim/wonder.js (WonderGame). Art: the game's own ring / egg / nest / hen painters plus render/wonder.js.
import { WonderGame } from './sim/wonder.js';
import { DT } from './sim/sim.js';
import { WONDER_LEVELS, wonderByKey } from './data/wonder-levels.js';
import { RING_TH, TAU, clamp, lerp, wrap } from './sim/geom.js';
import { THEMES, createBackdrop } from './themes.js';
import { FX } from './render/fx.js';
import * as W from './render/world.js';
import { drawHenActor } from './render/sprites.js';
import { ICON, drawStar, drawEggIcon, tint } from './ui/ui.js';
import { pictoClock, pictoBroken } from './ui/picto.js';
import { drawCelebration, pickRoutine, routinePower, routineCues } from './render/cheer.js';
import { drawExtraIcon } from './render/extras.js';
import { drawSpace, drawPlanet, drawSun, drawRail, drawPull, drawLamp, drawBolts, drawTurnArrow, drawFrost, drawStopClock, drawHand } from './render/wonder.js';

export function createWonder(env) {
  const { ctx, ui, audio } = env;
  const S = { level: null, game: null, t: 0, fx: [], cam: { x: 0, y: 0, k: 40 }, held: new Map(), card: null, cardT: 0, endT: 0, hens: [], touched: false, hatched: false, slow: 1, lastBump: 0, frost: 1, overT: 0, off: [], tipT: 0, arrows: [], zm: null, tp: new Map(), pinch: null, lastAct: null };
  const space = () => S.game && (S.game.kind === 'planet' || S.game.kind === 'mama');
  const starsOf = (key) => (env.save().wonder || {})[key] || 0;

  // o.side: played as a side quest from the map (0.8.17): its card first, the pause page, the campaign's pay and stars
  // (env.sideWin), and back to the map at its door (env.leave). o.go: straight into play (a retry), no card.
  function start(key, o = {}) {
    const L = wonderByKey(key);
    if (!L) return false;
    S.level = L;
    S.side = o.side ? { w: o.side.w, key } : null; S.pay = null; S.flown = false;
    S.game = new WonderGame(L);
    S.theme = THEMES.find((t) => t.id === L.theme) || THEMES[0];
    S.backdrop = createBackdrop(S.theme, L.id * 97);
    const z = env.size();
    S.backdrop.resize(z.W, z.H, z.DPR);
    S.fx = S.game.sims.map(() => new FX());
    S.hens = S.game.sims.map(() => ({ mood: 'idle', t: 0, face: 1 }));
    S.zm = null; S.pinch = null; S.tp.clear(); S.lastAct = null;
    S.t = 0; S.card = S.side && !o.go ? 'intro' : null; S.cardT = 0; S.endT = 0; S.touched = false; S.hatched = false; S.slow = 1; S.snap = true; S.overT = 0; S.tipT = 4.5; S.acc = 0;
    S.held.clear();
    S.frost = S.game.kind === 'plan' ? 1 : 0;
    W.setSkin(env.save().wallet.skin);
    audio.setMaterial(L.material || 'wood'); audio.setUnderwater(false); audio.setWind(0); audio.setFireLoop(false);
    audio.music(S.theme.music);
    env.setScreen('wonder');
    return true;
  }
  function quit() {
    for (const h of S.held.values()) if (h.ring) h.ring.held = false;
    S.held.clear();
    audio.setRingTurn(0);
    env.leave(S.side);
  }
  // the phone's Back (main.js): the card -> the map; play -> the pause page; the pause page -> play; an end page -> the map
  function back() {
    if (!S.game) return false;
    if (!S.side) { quit(); return true; }
    if (S.card === 'pause') press('wv:resume');
    else if (!S.card && S.game.state === 'play') press('wv:pause');
    else quit();
    return true;
  }

  // ---------------------------------------------------------------- layout and camera
  // where each vault sits on the stage (metres) and the box the camera must show
  const SUN_R = 0.8, HEN_M = 1.0; // m: the sun's orbit beyond the outer ring; mama's height beyond her rail
  function stage() {
    const g = S.game, z = env.size(), boxes = g.sims.map((sim) => {
      // planet / mama: the play disc (sun orbit / her rail and her) fills ~95% of the narrow side of the screen
      if (g.kind === 'planet') { const R = sim.outerR + SUN_R + 0.3; return { x0: -R, x1: R, y0: -R, y1: R }; }
      if (g.kind === 'mama') { const R = sim.nestR + HEN_M + 0.12; return { x0: -R, x1: R, y0: -R, y1: R }; }
      const R = sim.outerR + 0.5;
      return { x0: -R, x1: Math.max(R, sim.nestW / 2 + 2.0), y0: sim.groundY - 0.35, y1: R };
    });
    const off = [{ x: 0, y: 0 }];
    let B = { ...boxes[0] };
    if (boxes.length > 1) {
      const a = boxes[0], b = boxes[1];
      if (z.W > z.H) { off[1] = { x: a.x1 - b.x0 + 0.5, y: 0 }; B = { x0: a.x0, x1: off[1].x + b.x1, y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1) }; }
      else { off[1] = { x: 0, y: a.y0 - b.y1 - 0.45 }; B = { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: off[1].y + b.y0, y1: a.y1 }; }
    }
    S.off = off;
    return B;
  }
  // 0.8.17 (mykee: "zoom controls and camera movements are not present in Extras"): the road's zoom buttons, pinch and
  // wheel, and its camera. Like the road, the buttons get their own strip (a bottom row; on a phone on its side, a right
  // column) so they never sit on a vault, the hen or the nest.
  function zoomBar() {
    const A = ui.A, u = ui.u, bs = Math.max(46, 55 * u), pad = 8 * u, side = A.w > A.h;
    return { bs, pad, side, gap: 8 * u, bot: A.y1 - 6 * u - bs };
  }
  // sweep817 (mykee: on a phone on its side "the vault should fill the height, the HUD should sit in the side margins
  // rather than over the vault"): when the vaults at the full height leave a margin wide enough on each side, the top
  // band goes; Pause, the eggs and clock, the name and the tip stand in the left margin (marginCol: its width)
  function marginCol() {
    const A = ui.A, u = ui.u, Z = zoomBar();
    if (!S.game || !(A.w > A.h * 1.3 && A.h < 560 * u)) return 0;
    const B = stage(), h = A.h - 20 * u, vw = h * (B.x1 - B.x0) / (B.y1 - B.y0), m = (A.w - (Z.side ? Z.bs + 2 * Z.pad : 0) - vw) / 2;
    return m >= 160 * u ? Math.min(m, 230 * u) : 0;
  }
  function playRect() {
    const A = ui.A, u = ui.u, Z = zoomBar(), top = A.y + (marginCol() ? 10 : 62) * u, bot = Math.max((S.game.kind === 'plan' ? 86 : 10) * u, Z.side ? 10 * u : Z.bs + Z.pad + 2 * u); // the vaults frame inside the safe rect
    const sw = Z.side ? Z.bs + 2 * Z.pad : 0;
    return { x: A.x, y: top, w: A.w - sw, h: A.y1 - top - bot };
  }
  // player zoom z (S.zm): -1 the whole stage, 0 the camera's own shot (null), +1 twice as close
  const setZoom = (z) => { z = clamp(z, -1, 1); S.zm = Math.abs(z) < 0.05 ? null : z; };
  // every egg still in play, in stage metres (each vault's offset added)
  function eggsAt() {
    const out = [];
    S.game.sims.forEach((sim, si) => { const o = S.off[si] || { x: 0, y: 0 }; for (const e of sim.aliveEggs()) { const p = e.body.getPosition(); out.push({ x: p.x + o.x, y: p.y + o.y }); } });
    return out;
  }
  // zoom out and slide just enough that every point (plus m metres) is in the play rect (the road's keepInView)
  function keepIn(T, pts, m, P) {
    if (!pts.length) return T;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const q of pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    x0 -= m; x1 += m; y0 -= m; y1 += m;
    const k = Math.min(T.k, P.w / (x1 - x0), P.h / (y1 - y0)), hw = P.w / (2 * k), hh = P.h / (2 * k);
    return { x: clamp(T.x, x1 - hw, x0 + hw), y: clamp(T.y, y1 - hh, y0 + hh), k };
  }
  // keep a shot inside the stage box where it can (no empty space past the vaults when it could show vault)
  function inBox(T, B, P) {
    const hw = P.w / (2 * T.k), hh = P.h / (2 * T.k), cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2;
    return { x: B.x1 - B.x0 > 2 * hw ? clamp(T.x, B.x0 + hw, B.x1 - hw) : cx, y: B.y1 - B.y0 > 2 * hh ? clamp(T.y, B.y0 + hh, B.y1 - hh) : cy, k: T.k };
  }
  function camera(dt) {
    const B = stage(), P = playRect(), g = S.game, calm = env.save().calm;
    const F = { x: (B.x0 + B.x1) / 2, y: (B.y0 + B.y1) / 2, k: Math.min(P.w / (B.x1 - B.x0), P.h / (B.y1 - B.y0)) };
    let T = F, rate = 3.2;
    const live = !S.card && g.state === 'play', eggs = live ? eggsAt() : [];
    // plan: while it plays out the camera leans in on the egg furthest along (never losing the nest)
    if (g.kind === 'plan' && g.phase !== 'plan' && g.state === 'play') {
      const sim = g.sim, eggs = sim.aliveEggs();
      if (eggs.length) {
        let lead = eggs[0];
        for (const e of eggs) if (sim.channelOf(e) > sim.channelOf(lead) || (sim.channelOf(e) === sim.channelOf(lead) && e.body.getPosition().y < lead.body.getPosition().y)) lead = e;
        const p = lead.body.getPosition(), k = T.k * 1.3, hw = P.w / (2 * k), hh = P.h / (2 * k);
        T = { x: clamp(lerp(T.x, p.x, 0.6), Math.min(B.x0 + hw, T.x), Math.max(B.x1 - hw, T.x)), y: clamp(lerp(T.y, p.y, 0.6), Math.min(B.y0 + hh, T.y), Math.max(B.y1 - hh, T.y)), k };
      }
    } else if (live && !calm && S.zm == null && g.kind === 'hatch' && eggs.length) { // (the twins and the disc vaults: one steady whole shot, both vaults whole)
      // the road's action cam: a gentle push in toward the eggs, pulled back just enough to keep every egg in the shot;
      // while a finger holds a ring the shot holds still, so the ring never slides
      if (S.held.size && S.lastAct) T = S.lastAct;
      else {
        let cx = 0, cy = 0; for (const q of eggs) { cx += q.x; cy += q.y; } cx /= eggs.length; cy /= eggs.length;
        T = keepIn({ x: lerp(F.x, cx, 0.5), y: lerp(F.y, cy, 0.5), k: F.k * 1.25 }, eggs, 1.1, P);
        T.k = Math.max(T.k, F.k); T = inBox(T, B, P); S.lastAct = T;
      }
      rate = 1.6; // slow and soft: a camera operator, not a chase cam
    }
    if (live && S.zm != null) { // the player's zoom (buttons, pinch, wheel) overrides the camera's own lean
      const z = S.zm;
      if (z < 0) T = { x: lerp(T.x, F.x, -z), y: lerp(T.y, F.y, -z), k: T.k * Math.pow(Math.min(1, F.k / T.k), -z) };
      else {
        let cx = T.x, cy = T.y;
        if (eggs.length) { cx = cy = 0; for (const q of eggs) { cx += q.x; cy += q.y; } cx = lerp(T.x, cx / eggs.length, Math.min(1, z * 2)); cy = lerp(T.y, cy / eggs.length, Math.min(1, z * 2)); }
        T = inBox({ x: cx, y: cy, k: T.k * Math.pow(2, z) }, B, P);
        if (g.kind === 'twin') T = keepIn(T, eggs, 0.9, P); // the twins: both vaults' eggs stay in the shot (both stay playable)
      }
      rate = 4.5;
    }
    const c = S.cam;
    if (S.snap || calm) { c.x = T.x; c.y = T.y; c.k = T.k; S.snap = false; }
    else { const a = 1 - Math.exp(-dt * rate); c.x += (T.x - c.x) * a; c.y += (T.y - c.y) * a; c.k *= Math.exp(Math.log(T.k / c.k) * a); }
  }
  const toScreen = (si, x, y) => { const P = playRect(), o = S.off[si] || { x: 0, y: 0 }; return { x: P.x + P.w / 2 + (o.x + x - S.cam.x) * S.cam.k, y: P.y + P.h / 2 - (o.y + y - S.cam.y) * S.cam.k }; };
  const toWorld = (si, sx, sy) => { const P = playRect(), o = S.off[si] || { x: 0, y: 0 }; return { x: (sx - P.x - P.w / 2) / S.cam.k + S.cam.x - o.x, y: -(sy - P.y - P.h / 2) / S.cam.k + S.cam.y - o.y }; };
  function vaultAt(sx, sy) {
    let best = 0, bd = 1e9;
    S.game.sims.forEach((sim, si) => { const w = toWorld(si, sx, sy), d = Math.hypot(w.x, w.y) - sim.outerR; if (d < bd) { bd = d; best = si; } });
    return best;
  }

  // ---------------------------------------------------------------- input
  function pointerDown(e) {
    const g = S.game;
    if (S.card === 'win' && S.cardT < SIDE_DONE) { S.cardT = SIDE_DONE; S.skip = true; return; } // 0.8.17 win817: a tap skips the win page's show to its end
    if (!g || S.card || g.state !== 'play') return;
    const x = e.clientX, y = e.clientY, si = vaultAt(x, y), w = toWorld(si, x, y);
    if (e.pointerType === 'touch') { // a second finger is a pinch: let go of what is held and turn nothing until the fingers lift (the road's rule)
      S.tp.set(e.pointerId, { x, y });
      if (S.tp.size > 1) {
        for (const h of S.held.values()) { if (h.ring) { h.ring.held = false; if (g.kind === 'twin') { const tw = g.sims[1 - h.si].rings[h.ring.i]; if (tw) tw.held = false; } } }
        S.held.clear();
        if (!S.pinch) { const [a, b] = [...S.tp.values()]; S.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: S.zm || 0 }; }
        return;
      }
    }
    if (g.kind === 'mama') {
      S.held.set(e.pointerId, { hen: true });
      g.setHen(Math.atan2(w.y, w.x));
      S.touched = true;
      return;
    }
    const sim = g.sims[si];
    if (Math.hypot(w.x, w.y) > sim.outerR + 1.6) return;
    const ring = g.ringAt(si, w.x, w.y);
    if (!ring) return;
    if (!g.canGrab(ring)) { if (g.phase !== 'run' && g.phase !== 'over') { ring.denied = 0.35; audio.play('motor_tick', { vol: 0.8 }); } return; }
    for (const h of S.held.values()) if (h.ring === ring) return;
    S.held.set(e.pointerId, { si, ring, x, y });
    ring.held = true;
    if (g.kind === 'twin') { const tw = g.sims[1 - si].rings[ring.i]; if (tw) tw.held = true; }
    if (g.kind !== 'plan') ring.target = ring.body.getAngle();
    S.touched = true;
    audio.play('grab', { vol: 0.6 });
  }
  function pointerMove(e) {
    const h = S.held.get(e.pointerId), g = S.game, tp = S.tp.get(e.pointerId);
    if (tp) { tp.x = e.clientX; tp.y = e.clientY; if (S.pinch && S.tp.size > 1) { const [a, b] = [...S.tp.values()]; setZoom(S.pinch.z + Math.log2(Math.hypot(a.x - b.x, a.y - b.y) / S.pinch.d)); return; } }
    if (!h || !g) return;
    const x = e.clientX, y = e.clientY;
    if (h.hen) { const w = toWorld(0, x, y); if (Math.hypot(w.x, w.y) > 0.4) g.setHen(Math.atan2(w.y, w.x)); return; }
    const c = toScreen(h.si, 0, 0), px = h.x - c.x, py = h.y - c.y, dx = x - h.x, dy = y - h.y, rr = Math.max(Math.hypot(px, py), 70 * ui.u);
    const d = -(px * dy - py * dx) / (rr * rr);
    g.turn(h.si, h.ring.i, d);
    if (g.kind === 'twin') S.arrows[h.ring.i] = { dir: Math.sign(d) || 1, si: h.si, t: S.t };
    if (g.kind === 'plan' && Math.abs(d) > 0.02 && S.t - (S.tickT || 0) > 0.09) { S.tickT = S.t; audio.play('ring_tick', { vol: 0.35 }); }
    h.x = x; h.y = y;
  }
  function pointerUp(e) {
    S.tp.delete(e.pointerId); if (S.tp.size < 2) S.pinch = null;
    const h = S.held.get(e.pointerId);
    if (!h) return;
    S.held.delete(e.pointerId);
    if (h.ring) {
      h.ring.held = false;
      if (S.game.kind === 'twin') { const tw = S.game.sims[1 - h.si].rings[h.ring.i]; if (tw) tw.held = false; }
      audio.play('release', { vol: 0.4 });
    }
  }
  function press(id) {
    const g = S.game;
    if (id.startsWith('wv:play:')) return start(id.slice(8));
    if (!g) return;
    if (id === 'wv:quit' || id === 'wv:map') { audio.play('ui_back'); quit(); }
    else if (id === 'wv:go') { if (S.card === 'intro') { S.card = null; S.cardT = 0; S.t = 0; S.tipT = 4.5; audio.play('ui_open'); } }
    else if (id === 'wv:pause') { if (!S.card && g.state === 'play') { S.card = 'pause'; S.cardT = 0; for (const h of S.held.values()) if (h.ring) h.ring.held = false; S.held.clear(); audio.setRingTurn(0); audio.play('ui_tap'); } }
    else if (id === 'wv:resume') { if (S.card === 'pause') { S.card = null; audio.play('ui_tap'); } }
    else if (id === 'wv:retry') start(S.level.key, { side: S.side, go: true });
    else if (id === 'wv:next') { const i = WONDER_LEVELS.indexOf(S.level), N = WONDER_LEVELS[i + 1]; if (N) start(N.key); else quit(); }
    else if (id === 'wv:hatch') { if (g.hatch()) { S.hatched = true; audio.play('unlock'); for (const h of S.held.values()) if (h.ring) h.ring.held = false; S.held.clear(); } }
    else if (id === 'wv:rewind') { if (g.rewind()) rebuilt(); }
    else if (id === 'wv:zin') setZoom((S.zm || 0) + 0.34);
    else if (id === 'wv:zout') setZoom((S.zm || 0) - 0.34);
    else if (id === 'wv:zauto') S.zm = null;
  }
  function rebuilt() { // plan: the vault was rebuilt for a new attempt
    S.fx = S.game.sims.map(() => new FX());
    S.overT = 0; S.slow = 1;
    S.hens.forEach((h) => { h.mood = 'idle'; h.t = 0; });
    audio.play('rewind');
  }

  // ---------------------------------------------------------------- events -> feel
  function hen(si, mood, t) { const h = S.hens[si]; if (h) { h.mood = mood; h.t = t; } }
  function events() {
    const g = S.game, calm = env.save().calm;
    for (const ev of g.events) {
      const fx = S.fx[ev.si] || S.fx[0], sim = g.sims[ev.si] || g.sim, floor = space() ? undefined : sim.groundY + 0.02;
      switch (ev.type) {
        case 'bump':
          if (S.t - S.lastBump > 0.05 && ev.v > 1.2) {
            S.lastBump = S.t;
            const i = clamp(ev.v / 6, 0, 1);
            audio.play('egg_bump', { intensity: i, pitch: 1.12 - 0.3 * i });
            if (ev.v > 2.6) { audio.play('egg_land', { intensity: clamp((ev.v - 2.6) / 4.5, 0, 1), vol: 0.5 + 0.5 * i }); const p = ev.egg.body.getPosition(), d = Math.hypot(p.x, p.y) || 1, sg = sim.wk === 'planet' ? 1 : -1; fx.land(p.x - (sg * p.x / d) * 0.25, p.y - (sg * p.y / d) * 0.25, (sg * p.x) / d, (sg * p.y) / d, clamp((ev.v - 2) / 5, 0.1, 1)); }
          }
          break;
        case 'squish': audio.play('squish', { intensity: clamp(ev.v / 6, 0, 1) }); fx.dust(ev.x, ev.y, 3, 'rgba(255,230,150,0.7)'); break;
        case 'crack':
          audio.play('egg_crack');
          fx.shell(ev.x, ev.y, 0, 1, clamp((ev.v || 4) / 8, 0.35, 1), 8, floor);
          fx.impact(ev.x, ev.y, 0.3, '#ffe9b0');
          if (!calm) fx.kick(0.35);
          hen(ev.si, 'gasp', 1.2);
          break;
        case 'break':
          if (ev.egg && ev.egg.chick) { audio.play('hen_hop', { pitch: 1.5 }); fx.dust(ev.x, ev.y, 8, 'rgba(255,236,150,0.9)'); } // a chick that ran off: a puff of down, no yolk
          else {
            if (ev.why === 'thorn') { W.thornBite(sim, ev.x, ev.y, S.t); audio.play('thorn_hit'); }
            audio.play('egg_break');
            if (floor !== undefined) fx.yolk(ev.x, ev.y, floor); else fx.burst(ev.x, ev.y, 14, (i, a, b) => ({ x: ev.x, y: ev.y, vx: (a - 0.5) * 5, vy: (b - 0.5) * 5, drag: 2, life: 0.8 + b * 0.4, size: 0.04 + a * 0.04, color: i % 3 ? '#ffc21a' : '#ffe9a8', type: 'drop' }));
            fx.impact(ev.x, ev.y, 0.62, ev.why === 'thorn' ? '#ff6f5e' : '#ffd76a');
            fx.shell(ev.x, ev.y, 0, 1, 0.9, 9, floor);
          }
          if (!calm) fx.kick(0.6);
          hen(ev.si, 'cry', 2.2);
          break;
        case 'save':
          audio.play('egg_save', { pitch: 1 + (ev.combo - 1) * 0.12 });
          if (space()) { fx.sparkle(ev.x, ev.y, 16); fx.wave(ev.x, ev.y, 1.2, '#fff6c2', 0.5, 0.12); fx.wave(ev.x, ev.y, 1.9, '#ffffff', 0.65, 0.06, { delay: 0.08 }); }
          else fx.nestBurst(ev.x, ev.y - 0.12, S.theme.palette.nestStraw || '#d9b45a', floor);
          hen(ev.si, 'happy', 1.8);
          break;
        case 'portal': audio.play('portal_enter'); fx.sparkle(ev.x2, ev.y2, 8, '#ffcf8a'); break;
        case 'wHatch':
          audio.play('unlock', { pitch: 1.3 }); audio.play('hen_hop', { pitch: 1.6, vol: 0.7 });
          fx.sparkle(ev.x, ev.y, 16, '#ffe14d');
          fx.shell(ev.x, ev.y, 0, 1, 0.7, 8, floor);
          fx.wave(ev.x, ev.y, 0.9, '#fff3c0', 0.45, 0.1);
          hen(ev.si, 'happy', 1.4);
          break;
        case 'wTurn': fx.dust(ev.x, ev.y - 0.2, 2, 'rgba(255,240,200,0.6)'); break;
        case 'timeout': audio.play('level_fail', { vol: 0.5 }); break;
        case 'runOver': S.overT = 0.0001; hen(0, 'cry', 1.5); break;
        case 'wWon': audio.play('level_win'); break;
        default: break;
      }
    }
    g.events.length = 0;
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    const g = S.game;
    if (!g) return;
    if (S.card === 'intro' || S.card === 'pause') { S.cardT += dt; camera(dt); return; } // the side quest's card and the pause page: the vault stands still
    S.t += dt;
    if (S.tipT > 0 && S.touched) S.tipT = Math.min(S.tipT, 0.6);
    S.tipT -= dt;
    // plan: the last egg needed is nearly home -> slow motion
    let slow = 1;
    if (g.kind === 'plan' && g.phase === 'run' && g.state === 'play') {
      const sim = g.sim, need = (S.level.target || 1) - sim.savedLog.length;
      if (need === 1 && sim.aliveEggs().some((e) => sim.channelOf(e) >= sim.rings.length - 1)) slow = 0.4;
    }
    S.slow += (slow - S.slow) * Math.min(1, dt * 6);
    S.acc = Math.min(0.12, S.acc + dt * (env.save().calm ? slow : S.slow));
    let n = 0;
    while (S.acc >= DT && n < 24) { g.step(); S.acc -= DT; n++; }
    events();
    for (const sim of g.sims) for (const r of sim.rings) if (r.denied > 0) r.denied -= dt;
    S.fx.forEach((f) => f.update(dt));
    S.hens.forEach((h) => { if (h.t > 0 && (h.t -= dt) <= 0) h.mood = 'idle'; });
    S.frost += ((g.kind === 'plan' && g.phase === 'plan' ? 1 : 0) - S.frost) * Math.min(1, dt * 5);
    // mama: she flaps and clucks as she runs; feathers fly
    if (g.kind === 'mama') {
      const sim = g.sim, H = sim.hen, hp = henSpot(sim);
      if (H.run > 0.45 && g.state === 'play') {
        if (Math.random() < dt * 9) S.fx[0].add({ x: hp.x - hp.ux * 0.5, y: hp.y - hp.uy * 0.5, vx: -Math.sin(H.a) * -Math.sign(H.w) * 1.2 + (Math.random() - 0.5), vy: Math.cos(H.a) * -Math.sign(H.w) * 1.2 + (Math.random() - 0.5), drag: 1.6, life: 0.7 + Math.random() * 0.4, size: 0.05 + Math.random() * 0.03, color: Math.random() < 0.5 ? '#ffffff' : '#f3e6d0', type: 'chip', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10 });
        if (S.t - (S.cluckT || 0) > 0.42) { S.cluckT = S.t; audio.play('hen_hop', { vol: 0.35, pitch: 1.1 + Math.random() * 0.3 }); }
      }
      if (Math.abs(H.w) > 0.1) S.hens[0].face = Math.sign(H.w);
    }
    // plan: a failed run winds itself back after a beat
    if (S.overT > 0 && (S.overT += dt) > 1.3 && g.phase === 'over') { if (g.rewind()) rebuilt(); }
    let turn = 0;
    for (const sim of g.sims) for (const r of sim.rings) if (r.held && g.kind !== 'plan') turn = Math.max(turn, Math.abs(r.omega) / (sim.maxOmega(r) || 1));
    audio.setRingTurn(g.state === 'play' ? clamp(turn, 0, 1) : 0);
    if (g.timeLimit && g.state === 'play' && g.timeLeft <= 10) { const s = Math.ceil(g.timeLeft); if (s !== S.lastTick) { S.lastTick = s; audio.play('countdown', { pitch: s <= 3 ? 1.3 : 1 }); } }
    // end cards
    if (g.state !== 'play' && !S.card) {
      S.endT += dt;
      if (S.endT > (g.state === 'won' ? 1.3 : 0.9)) {
        S.card = g.state === 'won' ? 'win' : 'fail'; S.cardT = 0; S.st0 = S.st1 = S.st2 = 0; S.skip = false;
        S.cheer = g.state === 'won' ? pickRoutine({ stars: g.stars(), last: S.cheer }) : 'encourage'; // her show on a side quest's end page
        for (const h of S.held.values()) if (h.ring) h.ring.held = false;
        S.held.clear();
        if (g.state === 'won') {
          const sv = env.save(), st = g.stars();
          if (S.side && env.sideWin) S.pay = env.sideWin(S.level.key, st); // a side quest: the campaign pays it and files its stars (main.js)
          else {
            sv.wonder = sv.wonder || {};
            if (st > (sv.wonder[S.level.key] || 0)) { sv.wonder[S.level.key] = st; env.persist(); }
          }
        } else audio.play('level_fail');
      }
    }
    if (S.card) { const c0 = S.cardT - 0.25; S.cardT += dt; if (S.side && (S.card === 'win' || S.card === 'fail') && !env.save().calm) for (const [, n, o] of routineCues(S.cheer, c0, S.cardT - 0.25)) audio.play(n, o); } // her show's own sounds
    camera(dt);
  }

  // ---------------------------------------------------------------- render
  // where mama stands on her rail (beside the nest), and her "up" (toward the centre)
  function henSpot(sim) {
    const H = sim.hen, R = sim.nestR + 0.02, a = H.a - (sim.nestW / 2 + 0.75) / R;
    return { x: R * Math.cos(a), y: R * Math.sin(a), a, ux: -Math.cos(a), uy: -Math.sin(a) };
  }
  function drawHen(si, sim, k, t) {
    const g = S.game, h = S.hens[si];
    ctx.save();
    let hs;
    if (g.kind === 'planet') { hs = 1.2 * k; ctx.translate(0, -0.52); ctx.scale(1 / k, -1 / k); }
    else if (g.kind === 'mama') {
      const p = henSpot(sim), run = sim.hen.run;
      hs = Math.min(HEN_M * k, Math.max(40, 1.5 * k)); // never taller than the margin outside her rail
      ctx.translate(p.x, p.y); ctx.rotate(p.a + Math.PI / 2); ctx.scale(1 / k, -1 / k);
      ctx.scale(h.face < 0 ? 1 : -1, 1);
      if (run > 0.2) { ctx.translate(0, -Math.abs(Math.sin(t * 17)) * hs * 0.1 * run); ctx.rotate(Math.sin(t * 17) * 0.12 * run); }
    } else {
      const n = sim.nest.getPosition();
      hs = Math.max(1.0 * k, Math.min(56, 1.5 * k));
      ctx.translate(n.x + sim.nestW / 2 + 0.25 + hs / k * 0.5, sim.groundY); ctx.scale(1 / k, -1 / k);
    }
    const run = g.kind === 'mama' && sim.hen.run > 0.45;
    drawHenActor(ctx, run && h.mood === 'idle' ? 'happy' : h.mood, 0, -0.49 * hs, hs, t, { key: 'wv' + si, look: 0, danger: 0, shadow: g.kind === 'planet' ? 0 : 0.26 });
    ctx.restore();
  }

  function drawVault(si, t) {
    const g = S.game, sim = g.sims[si], fx = S.fx[si], k = S.cam.k, o = S.off[si], P = playRect(), z = env.size();
    ctx.setTransform(z.DPR, 0, 0, z.DPR, 0, 0);
    const calm = env.save().calm, tr = calm ? 0 : fx.shake * fx.shake, amp = clamp(7 * ui.u, 5, 10) * tr;
    ctx.translate(P.x + P.w / 2 + amp * Math.sin(t * 53.1), P.y + P.h / 2 + amp * Math.sin(t * 47.3 + 1.3));
    ctx.scale(k, -k);
    ctx.translate(o.x - S.cam.x, o.y - S.cam.y);
    const straw = S.theme.palette.nestStraw || '#d9b45a';
    W.drawVaultBack(ctx, sim, S.theme);
    if (g.kind === 'mama') { drawPull(ctx, sim, t); drawRail(ctx, sim.nestR + 0.1, '#b9854e'); }
    fx.draw(ctx, 'back');
    for (const pt of sim.portals) W.drawPortalPull(ctx, pt, t);
    for (const pt of sim.portals) { W.drawPortal(ctx, pt.ax, pt.ay, t, false); W.drawPortal(ctx, pt.bx, pt.by, t, true); }
    if (g.timeLimit && g.state === 'play') {
      const frac = g.timeLeft / g.timeLimit;
      if (g.kind === 'planet') drawSun(ctx, sim.outerR + SUN_R, frac, t, fx);
      else W.drawFuse(ctx, sim.outerR + 0.32, frac, t, fx, sim.rings[sim.rings.length - 1]);
    }
    if (g.kind === 'planet') drawPlanet(ctx, sim, straw, t);
    else if (g.kind === 'mama') { const n = sim.nest.getPosition(); ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(sim.nest.getAngle()); ctx.translate(-n.x, -n.y); W.drawNest(ctx, sim, S.theme, t, sim.savedLog.length); ctx.restore(); }
    else W.drawNest(ctx, sim, S.theme, t, sim.savedLog.length);
    if (g.kind === 'planet') drawHen(si, sim, k, t);
    if (sim.lamp) drawLamp(ctx, sim, t, 'light');
    const eggs = sim.aliveEggs(), eggPts = eggs.map((e) => e.body.getPosition());
    for (const ring of sim.rings) {
      ctx.save();
      if (ring.denied > 0) ctx.rotate(Math.sin(t * 60) * 0.01 * ring.denied);
      W.drawRing(ctx, ring, S.theme, k, t, { held: !!ring.held, hover: false, eggs: eggPts, simT: sim.t, stuck: [] });
      W.drawV3Ring(ctx, ring, k, t, S.theme);
      if (ring.spec.fixed) drawBolts(ctx, ring);
      ctx.restore();
      if (ring.gearOut) W.drawGearCog(ctx, ring, ring.gearOut, t);
    }
    if (g.kind === 'twin') for (const ring of sim.rings) { // the link: both twins show which way they turn
      const A = S.arrows[ring.i], on = A && S.t - A.t < 0.5 && ring.held;
      ring.wArr = clamp((ring.wArr || 0) + (on ? 0.15 : -0.08), 0, 1);
      if (A) drawTurnArrow(ctx, ring.r, Math.PI / 2, A.dir * (A.si === si ? 1 : -1), ring.wArr * 0.95, si ? '#9fe0ff' : '#ffe08a');
    }
    if (sim.lamp) drawLamp(ctx, sim, t, 'lamp');
    if (g.kind !== 'planet') drawHen(si, sim, k, t);
    for (const b of sim.bombs) if (b.alive) b.spark = W.drawBomb(ctx, b, t);
    for (const d of sim.debris) W.drawDebris(ctx, d, S.theme);
    for (const e of eggs) {
      const p = e.body.getPosition();
      if (g.kind === 'planet') { const d = Math.hypot(p.x, p.y) || 1; e.wsh = { x: -p.x / d, y: -p.y / d }; } // its shadow falls toward the planet
      else if (g.kind === 'mama') { const u = sim.pullDir(p); e.wsh = { x: u[0], y: u[1] }; }
      if (e.warm > 0 && !e.chick) { ctx.save(); ctx.translate(p.x, p.y); const j = 0.02 * Math.sin(t * 40) * Math.min(1, e.warm * 2); ctx.translate(j, 0); ctx.translate(-p.x, -p.y); W.drawEgg(ctx, e, t, k); ctx.restore(); }
      else W.drawEgg(ctx, e, t, k);
    }
    fx.draw(ctx, 'front');
  }

  function render() {
    const g = S.game, z = env.size(), t = S.t, u = ui.u;
    if (!g) return;
    ctx.setTransform(z.DPR, 0, 0, z.DPR, 0, 0);
    stage();
    if (space()) drawSpace(ctx, z.W, z.H, t, g.kind === 'mama' ? 1 : 0);
    else {
      S.backdrop.draw(ctx, t, { x: 0, y: 0, zoom: 1 });
      const order = g.sims.map((_, i) => i).sort((a, b) => S.off[b].y - S.off[a].y); // upper vault's ground first
      for (const si of order) {
        const sim = g.sims[si], gy = toScreen(si, 0, sim.groundY).y, n = toScreen(si, sim.nest.getPosition().x, 0);
        const next = order[order.indexOf(si) + 1], hBand = next != null && S.off[next].y !== S.off[si].y ? Math.min(z.H - gy, 0.5 * S.cam.k) : z.H - gy;
        if (gy < z.H) { ctx.save(); ctx.beginPath(); ctx.rect(0, gy - 40 * u, z.W, hBand + 40 * u); ctx.clip(); S.backdrop.drawGround(ctx, 0, gy, z.W, z.H - gy, t, { x: n.x, k: S.cam.k, nw: sim.nestW }); ctx.restore(); }
      }
    }
    for (let si = 0; si < g.sims.length; si++) drawVault(si, t);
    ctx.setTransform(z.DPR, 0, 0, z.DPR, 0, 0);
    if (!space()) S.backdrop.drawAmbient(ctx, t, S.cam);
    if (g.kind === 'twin') drawTwinLink(t);
    drawFrost(ctx, z.W, z.H, t, S.frost * 0.9);
    const fl = Math.max(...S.fx.map((f) => f.flash));
    if (fl > 0 && !env.save().calm) { ctx.globalAlpha = fl * 0.5; ctx.fillStyle = '#fff2c4'; ctx.fillRect(0, 0, z.W, z.H); ctx.globalAlpha = 1; }
    drawHint(t);
    if (!(S.side && S.card)) drawHUD(); // (a side quest's pages stand alone: no clock under them, room for the purse)
    if (S.card === 'intro') drawIntro();
    else if (S.card === 'pause') drawPause();
    else if (S.card && S.side) drawSideEnd();
    else if (S.card) drawCard();
  }

  // twin: a golden cord between the two vault hubs with a little gear on it; it pulses while a ring is held
  function drawTwinLink(t) {
    const a = toScreen(0, 0, 0), b = toScreen(1, 0, 0), g = S.game, u = ui.u;
    const held = g.sims[0].rings.some((r) => r.held), dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const r0 = (g.sims[0].outerR + 0.25) * S.cam.k, r1 = (g.sims[1].outerR + 0.25) * S.cam.k;
    const x0 = a.x + ux * r0, y0 = a.y + uy * r0, x1 = b.x - ux * r1, y1 = b.y - uy * r1;
    if (Math.hypot(x1 - x0, y1 - y0) < 6) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(40,20,0,0.45)'; ctx.lineWidth = 7 * u; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = held ? '#ffe9a0' : '#e0b24a'; ctx.lineWidth = 3.5 * u; ctx.setLineDash([6 * u, 6 * u]); ctx.lineDashOffset = held ? -t * 40 : 0;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.restore();
  }

  // the teaching hand: shows the one gesture of the level until the player has done it
  function drawHint(t) {
    const g = S.game, u = ui.u;
    if (g.state !== 'play' || S.card || t < 0.9) return;
    const ph = ((t - 0.9) % 2.6) / 2.6, mv = clamp((ph - 0.15) / 0.55, 0, 1), e = mv * mv * (3 - 2 * mv), al = Math.min(1, ph / 0.1, (1 - ph) / 0.15) * 0.95, hs = 34 * u;
    const arc = (si, R, a0, a1) => { const a = a0 + (a1 - a0) * e, p = toScreen(si, R * Math.cos(a), R * Math.sin(a)); drawHand(ctx, p.x, p.y, hs, ph > 0.12 && ph < 0.8, al); };
    const D = Math.PI / 180;
    if (g.kind === 'plan' && S.touched && !S.hatched && g.phase === 'plan') { const b = ui.buttons.find((q) => q.id === 'wv:hatch'); if (b) drawHand(ctx, b.x + b.w * 0.72, b.y + b.h * 0.45, hs, ph > 0.3 && ph < 0.7, al); return; }
    if (S.touched) return;
    if (g.kind === 'planet') { const r = g.sim.rings[g.sim.rings.length - 1], a0 = r.body.getAngle() + r.gaps[0].a; arc(0, r.r, a0, a0 + 30 * D); }
    else if (g.kind === 'mama') arc(0, g.sim.nestR + 0.1, g.sim.hen.a, g.sim.hen.a - 70 * D);
    else if (g.kind === 'twin') { const r = g.sims[1].rings[0], a0 = r.body.getAngle() + r.gaps[0].a; arc(1, Math.max(r.r, 1.6), a0, a0 - 80 * D); }
    else { const r = g.sim.rings[0], a0 = r.body.getAngle() + r.gaps[0].a; arc(0, Math.max(r.r, 1.6), a0, a0 - 70 * D); }
  }

  const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function drawHUD() {
    const g = S.game, A = ui.A, u = ui.u, pad = 10 * u, st = g.stats(), L = S.level, X0 = A.x + pad, Y0 = A.y + pad;
    ui.calm = env.save().calm;
    if (S.side) ui.button('wv:pause', '', X0, Y0, 44 * u, 44 * u, { kind: 'hud', icon: ICON.pause, iconS: 1.1, round: 14 * u }); // a side quest: the pause page (Resume, Retry, Map)
    else ui.button('wv:quit', '', X0, Y0, 44 * u, 44 * u, { kind: 'hud', icon: ICON.left, iconS: 1.3, round: 14 * u });
    // right: eggs home (per vault) and the clock (or the attempt count)
    const eggsTxt = st.per.map((p) => `${p.saved}/${p.target}`).join('  '), right = g.kind === 'plan' ? `Try ${st.attempts}` : fmt(g.timeLeft);
    const MC = marginCol(), colW = MC - 2 * pad;
    const ew = ui.measure(eggsTxt, 17 * u), rw = ui.measure(g.kind === 'plan' ? 'Try 88' : '0:00', 17 * u), cw = 30 * u + ew + 14 * u + rw + 14 * u, cx = MC ? X0 : A.x1 - pad - cw, cy = MC ? Y0 + 44 * u + 10 * u + 19 * u : Y0 + 22 * u;
    ui.glass(cx, cy - 19 * u, cw, 38 * u);
    drawEggIcon(ctx, cx + 17 * u, cy, 11 * u, 'ok');
    ui.text(eggsTxt, cx + 30 * u, cy + 0.5 * u, { size: 17 * u, color: '#fff', stroke: 'rgba(30,14,4,0.7)', strokeW: 3 * u, tag: 'wv:eggs' });
    ui.text(right, cx + cw - 14 * u, cy + 0.5 * u, { size: 17 * u, align: 'right', color: g.timeLimit && g.timeLeft < 10 ? '#ff8a6a' : '#ffe9a8', stroke: 'rgba(30,14,4,0.7)', strokeW: 3 * u, tag: 'wv:clock' });
    const tl = X0 + 44 * u + 10 * u, trr = cx - 10 * u;
    if (MC) ui.text(L.name, X0, cy + 19 * u + 10 * u + 11 * u, { size: 19 * u, color: '#fff', stroke: 'rgba(30,14,4,0.75)', strokeW: 4 * u, shadow: 'rgba(30,14,4,0.6)', tag: 'wv:name', maxW: colW });
    else if (trr - tl > 70 * u) ui.text(L.name, (tl + trr) / 2, cy + 0.5 * u, { size: 19 * u, align: 'center', color: '#fff', stroke: 'rgba(30,14,4,0.75)', strokeW: 4 * u, shadow: 'rgba(30,14,4,0.6)', tag: 'wv:name', maxW: trr - tl });
    // the zoom buttons (the road's: -, + and, while the player's zoom is on, auto)
    const Z = zoomBar(), zl = g.state === 'play' && !S.card ? drawZoom(Z) : A.x1;
    // plan: HATCH / REWIND and the stopped clock (left of the zoom buttons when they share the bottom row)
    if (g.kind === 'plan' && !S.card) {
      const r0 = Z.side ? A.x1 : zl - 10 * u, l0 = A.x + 14 * u + 56 * u, bw = Math.min(250 * u, A.w - 110 * u, r0 - l0), bh = 60 * u, bx = Z.side ? A.cx - bw / 2 + 22 * u : l0 + (r0 - l0 - bw) / 2, by = A.y1 - bh - 14 * u;
      drawStopClock(ctx, bx - 34 * u, by + bh * 0.45, 40 * u, g.phase === 'plan');
      ui.record({ x: bx - 56 * u, y: by + bh * 0.45 - 22 * u, w: 44 * u, h: 44 * u }, 'wv:clockicon');
      if (g.phase === 'plan') ui.button('wv:hatch', 'HATCH', bx, by, bw, bh, { kind: 'primary', shimmer: S.touched, icon: ICON.play, size: 26 * u, round: 18 * u });
      else if (g.state === 'play') ui.button('wv:rewind', 'REWIND', bx, by, bw, bh, { kind: 'secondary', icon: ICON.retry, size: 22 * u, round: 18 * u });
    }
    // the tip: one line at the start, gone on the first touch
    if (S.tipT > 0 && L.tip && !S.card) {
      const a = clamp(S.tipT / 0.5, 0, 1) * clamp(S.t / 0.4, 0, 1), ts = 14 * u, mw = MC ? colW : Math.min(A.w - 28 * u, 520 * u), lines = wrapText(L.tip, ts, mw - 28 * u);
      const h = lines.length * ts * 1.3 + 16 * u, w = Math.max(...lines.map((l) => ui.measure(l, ts))) + 28 * u, x = MC ? X0 : A.cx - w / 2, y = MC ? cy + 19 * u + 10 * u + 26 * u : A.y + 66 * u, tx = x + w / 2;
      ctx.save(); ctx.globalAlpha = a; ui.aBase = a;
      ui.glass(x, y, w, h, { r: 14 * u });
      lines.forEach((l, i) => ui.text(l, tx, y + 8 * u + ts * 0.65 + i * ts * 1.3, { size: ts, align: 'center', color: '#fff', tag: 'wv:tip' + i, group: 'wv:tip' }));
      ui.aBase = 1; ctx.restore();
    }
  }
  function drawZoom(Z) { // returns the left edge of the row (portrait)
    const A = ui.A, u = ui.u, items = [['wv:zin', ICON.zoom(true), ''], ['wv:zout', ICON.zoom(false), '']];
    if (S.zm != null) items.push(['wv:zauto', null, 'auto']);
    const P = playRect();
    let left = A.x1;
    items.forEach(([id, icon, label], i) => {
      const x = Z.side ? A.x1 - Z.pad - Z.bs : A.x1 - Z.pad - Z.bs * (i + 1) - Z.gap * i;
      const y = Z.side ? P.y + (P.h - (Z.bs * 3 + Z.gap * 2)) / 2 + (Z.bs + Z.gap) * i : Z.bot;
      ui.button(id, label, x, y, Z.bs, Z.bs, { kind: 'hud', icon, iconS: 1.3, size: label ? 13 * u : undefined, round: 15 * u });
      left = Math.min(left, x);
    });
    return left;
  }
  // a mouse wheel zooms, as on the road
  function wheel(e) { if (S.game && !S.card && S.game.state === 'play') setZoom((S.zm || 0) - clamp(e.deltaY, -120, 120) * 0.003); }
  function wrapText(text, size, maxW) {
    const out = []; let cur = '';
    for (const w of text.split(' ')) { const tr = cur ? cur + ' ' + w : w; if (ui.measure(tr, size) > maxW && cur) { out.push(cur); cur = w; } else cur = tr; }
    if (cur) out.push(cur);
    return out;
  }

  function drawCard() {
    const g = S.game, z = env.size(), A = ui.A, u = ui.u, win = S.card === 'win', st = g.stats(), stars = g.stars(), L = S.level;
    const a = clamp(S.cardT / 0.25, 0, 1);
    ctx.fillStyle = `rgba(10,6,20,${0.5 * a})`; ctx.fillRect(0, 0, z.W, z.H);
    const w = Math.min(330 * u, A.w - 28 * u), h = (win ? 268 : 220) * u, x = A.cx - w / 2, y = Math.max(A.y + 24 * u, A.cy - h / 2) + (1 - a) * 20 * u;
    K.scene({ cx: A.cx, gy: y + h - 78 * u, hh: 120 * u, sy: y + h * 0.4 }, a, win); // frame818 (mykee: no frames): the road's frameless scene edge to edge, the buttons on its meadow
    ctx.save(); ctx.globalAlpha = a; ui.aBase = a;
    ui.ribbon(win ? L.name : 'So close!', A.cx, y - 16 * u, Math.min(w - 20 * u, 270 * u), 40 * u, { color: win ? '#e8503a' : '#6c7aa0', size: 21 * u, tag: 'wv:cardtitle' });
    let cy = y + 62 * u;
    if (win) {
      for (let i = 0; i < 3; i++) { const on = i < stars && S.cardT > 0.35 + i * 0.28, p = on ? clamp((S.cardT - 0.35 - i * 0.28) / 0.25, 0, 1) : 1; drawStar(ctx, A.cx + (i - 1) * 62 * u, cy + (i === 1 ? -6 * u : 0), (i === 1 ? 29 : 24) * u * (on ? 0.7 + 0.3 * (1 + 0.6 * Math.sin(p * Math.PI)) * 1 : 1), on, p); }
      ui.record({ x: A.cx - 90 * u, y: cy - 36 * u, w: 180 * u, h: 66 * u }, 'wv:stars');
      cy += 56 * u;
    }
    const line = g.kind === 'plan' ? (win ? `Solved on try ${st.attempts}` : 'The eggs did not make it') : `${st.saved} of ${st.total} home`;
    ui.text(line, A.cx, cy, { size: 19 * u, align: 'center', color: '#5a3416', tag: 'wv:cardline', maxW: w - 30 * u });
    const sub = win ? (stars === 3 ? 'Perfect!' : g.kind === 'plan' ? `3 stars: solve it in ${(L.wonder.par || [2])[0]} tries` : st.broken ? '2 stars: lose no egg' : '3 stars: not a single crack') : g.kind === 'twin' ? 'Save an egg from each vault' : `Bring ${st.target} home`;
    ui.text(sub, A.cx, cy + 26 * u, { size: 14 * u, align: 'center', color: '#8a6238', tag: 'wv:cardsub', maxW: w - 30 * u });
    const by = y + h - 70 * u, bh = 52 * u, gap = 10 * u, bw = (w - 36 * u - gap) / 2, hasNext = win && WONDER_LEVELS.indexOf(L) < WONDER_LEVELS.length - 1;
    ui.button('wv:quit', 'Vaults', x + 18 * u, by, bw, bh, { kind: 'secondary', icon: ICON.grid, size: 17 * u });
    if (hasNext) ui.button('wv:next', 'Next', x + 18 * u + bw + gap, by, bw, bh, { kind: 'primary', icon: ICON.play, size: 19 * u, shimmer: true });
    else ui.button('wv:retry', win ? 'Again' : 'Retry', x + 18 * u + bw + gap, by, bw, bh, { kind: win ? 'secondary' : 'primary', icon: ICON.retry, size: 18 * u });
    ui.aBase = 1; ctx.restore();
  }

  // ---------------------------------------------------------------- the side quest's pages (0.8.17)
  // its card (the vault's picture, its one line, the stars it has, the coins its next win pays, PLAY), the pause page,
  // and its win / fail pages. 0.8.17 polish (mykee: every page uses the full screen): the road's page family, laid out
  // with the road's own kit (env.kit: the full page with even gaps, the side stage on a wide screen, her stage, the pause
  // tiles, the purse). Portrait: the page is the screen, its big stage (the vault's picture, or the hen) takes the room
  // the rest leaves, the main button sits at the bottom in thumb reach. Landscape: the stage stands left of the card.
  // Back on every page leads to the map at the vault's door.
  const ease = (k) => { k = clamp(k, 0, 1); return 1 - (1 - k) ** 3; };
  const backOut = (k) => { k = clamp(k, 0, 1); const c1 = 1.7, c3 = c1 + 1, q = k - 1; return 1 + c3 * q * q * q + c1 * q * q; };
  const K = env.kit;
  const coinPill = (cx, cy, n, s, tag) => { // a pill: a coin and +n
    const txt = '+' + n, fs = 19 * s, tw = ui.measure(txt, fs), cr = 11 * s, w = cr * 2 + 8 * s + tw + 24 * s, x = cx - w / 2;
    ui.roundRect(x, cy - 17 * s, w, 34 * s, 17 * s); ctx.fillStyle = 'rgba(60,30,8,0.16)'; ctx.fill();
    env.drawCoin(ctx, x + 12 * s + cr, cy, cr, env.save().calm ? 0 : S.t);
    ui.text(txt, x + 12 * s + cr * 2 + 8 * s, cy + 0.5 * s, { size: fs, color: '#6a3a08', tag, maxW: tw + 4 * s });
    return { x: x + 12 * s + cr, y: cy, w };
  };
  // the stage's height (design units, portrait): what the page leaves once the other blocks have their room
  function roomFor(build, lo, hi) {
    const A = ui.A, u = ui.u, rest = build(0)(1).reduce((a, b) => a + (b.gap ?? 10) + b.h, 0) + K.head() + 22;
    return clamp((A.h - 30 * u) / u - rest - 4, lo, hi);
  }
  // the vault's picture on a stage of its own colour with slow rays (the card and the pause page)
  function picStage(x, y, w, h, s, big, keep) { // keep { x1, y1 }: the corner button's far edges; the picture stays clear of it
    const L = S.level, col = TILE[L.wonder.kind] || '#5a6ad8', t = env.save().calm ? 0 : S.t + S.cardT;
    // frame818 (mykee: no frames): no well around it; the picture floats on the page's scene, its own colour glowing
    // behind it and slow rays (the art a size up into the room the frame took)
    const R0 = Math.min(w, h) * 0.62, gl = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, R0);
    gl.addColorStop(0, tint(col, 0.35) + 'cc'); gl.addColorStop(1, tint(col, 0.35) + '00');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, R0, 0, Math.PI * 2); ctx.fill();
    K.sunburst(x + w / 2, y + h / 2, Math.max(w, h) * (big ? 0.7 : 0.62), 'rgba(255,255,255,0.22)');
    let pic = Math.min(h * (big ? 0.86 : 0.86), w * (big ? 0.86 : 0.8)), px = x + w / 2, py = y + h / 2;
    if (keep) { // (0.8.18, a short screen on its side: the picture slid under the back button) down, then across, then smaller
      const hit = () => px - pic / 2 < keep.x1 && py - pic / 2 < keep.y1;
      if (hit()) py = Math.max(py, Math.min(keep.y1 + pic / 2, y + h - pic / 2));
      if (hit()) px = Math.max(px, Math.min(keep.x1 + pic / 2, x + w - pic / 2));
      if (hit()) { const d = Math.min(keep.x1 - (px - pic / 2), keep.y1 - (py - pic / 2)); pic -= d; px += d / 2; py += d / 2; }
    }
    drawExtraIcon(ctx, L.wonder.kind, px, py, pic, t, { calm: env.save().calm, bare: true });
    ui.record({ x: px - pic / 2, y: py - pic / 2, w: pic, h: pic }, 'wv:introPic', 'wv:introPic');
    if (/2$/.test(L.key)) { // the II badge on the picture's corner
      const k = pic / 150, tw = 30 * k, th = 20 * k, tx = px + pic / 2 - tw + 6 * k, ty = py - pic / 2 - 6 * k;
      ui.roundRect(tx, ty, tw, th, th / 2); ctx.fillStyle = '#d8402e'; ctx.fill(); ctx.lineWidth = 2 * k; ctx.strokeStyle = '#3a0a04'; ctx.stroke();
      ui.text('II', tx + tw / 2, ty + th / 2 + 0.5 * k, { size: 14 * k, align: 'center', color: '#fff', tag: 'wv:introII', group: 'wv:introPic' });
    }
  }
  // one centred line of ink on the page
  const inkLine = (str, size, tag, o = {}) => ({ h: size * 1.3, gap: o.gap, draw: (x, y, w) => ui.text(str, x + w / 2, y + size * 0.66, { size, align: 'center', maxW: w, color: o.color || ui.C.ink, tag }) });
  // a wide screen: the stage left of the card (null in portrait)
  const wideSide = () => { const A = ui.A; return A.w > A.h * 1.15 ? K.side() : null; };

  function drawIntro() {
    const A = ui.A, u = ui.u, L = S.level, best = starsOf(L.key), pay = env.sideCoins ? env.sideCoins(L.key) : 0, sd = wideSide();
    ui.calm = env.save().calm;
    K.dim(sd ? 0.74 : 0.6);
    const build = (stH) => (s) => {
      const B = [];
      if (stH > 0) B.push({ h: stH * s, gap: 4 * s, draw: (x, y, w) => picStage(x, y, w, stH * s, s, true) });
      B.push(inkLine(L.pitch, 20 * s, 'wv:introLine', { gap: 12 * s }));
      B.push({ h: 40 * s, gap: 8 * s, draw: (x, y, w) => { // the stars it has (sockets until won) and the coins its next win pays
        const sr = 17 * s, pw = pay ? ui.measure('+' + pay, 19 * s) + 22 * s + 32 * s : 0, gp = pay ? 22 * s : 0, sw = 6.6 * sr, x0 = x + w / 2 - (sw + gp + pw) / 2, cy = y + 20 * s;
        for (let i = 0; i < 3; i++) drawStar(ctx, x0 + sw / 2 + (i - 1) * 2.3 * sr, cy, sr, i < best);
        ui.record({ x: x0, y: cy - sr, w: sw, h: 2 * sr }, 'wv:introStars');
        if (pay) coinPill(x0 + sw + gp + pw / 2, cy, pay, s, 'wv:introPay');
      } });
      B.push({ h: 66 * s, gap: 14 * s, draw: (x, y, w) => ui.button('wv:go', 'PLAY', x, y, w, 66 * s, { kind: 'primary', shimmer: true, icon: ICON.play, size: 28 * s, round: 20 * s }) });
      return B;
    };
    const RIB = '#8a4ad8';
    if (sd) {
      const card = K.page(L.name, build(0), { ...sd.cardO, ribbon: RIB });
      const { box } = K.stage(sd, card);
      picStage(box.x, box.y, box.w, box.h, u, false, { x1: A.x + 8 * u + 46 * u + 4 * u, y1: A.y + 6 * u + 46 * u + 4 * u });
    } else K.page(L.name, build(roomFor(build, 120, 420)), { full: true, ribbon: RIB });
    const bs = 46 * u; // back to the map: the header's corner (on the page's top edge, level with the ribbon)
    ui.button('wv:map', '', A.x + 8 * u, A.y + 6 * u, bs, bs, { kind: 'hud', icon: ICON.left, iconS: 1.3, round: bs / 2 });
  }
  function drawPause() {
    const g = S.game, A = ui.A, u = ui.u, L = S.level, st = g.stats(), sd = wideSide(), C = ui.C;
    ui.calm = env.save().calm;
    K.dim(sd ? 0.74 : 0.6);
    const build = (stH) => (s) => {
      const B = [];
      B.push(inkLine(L.name, 20 * s, 'wv:pauseName', { gap: 2 * s }));
      B.push({ h: 56 * s, gap: 10 * s, draw: (x, y, w) => { // the goal and the clock (the road's pause page)
        ui.well(x, y, w, 56 * s, { s, a: '#f3e2bd', b: '#fbf0d6' });
        const a = `${st.saved}/${st.target} home`, tl = Math.ceil(Math.max(0, g.timeLeft || 0)), b = g.timeLimit ? `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}` : g.kind === 'plan' ? `Try ${st.attempts || 1}` : '';
        const aw = 32 * s + ui.measure(a, 20 * s), bw = b ? 32 * s + ui.measure(b, 20 * s) : 0, gp = b ? 26 * s : 0;
        let gx = x + w / 2 - (aw + gp + bw) / 2;
        drawEggIcon(ctx, gx + 12 * s, y + 28 * s, 30 * s, 'alive'); ui.text(a, gx + 30 * s, y + 28 * s, { size: 20 * s, color: st.saved >= st.target ? C.good : C.ink, tag: 'wv:pauseGoal' });
        if (b) { gx += aw + gp; if (g.timeLimit) pictoClock(ctx, gx + 12 * s, y + 28 * s, 28 * s); else drawStopClock(ctx, gx + 12 * s, y + 28 * s, 26 * s, false); ui.text(b, gx + 30 * s, y + 28 * s, { size: 20 * s, color: g.timeLimit && g.timeLeft <= 10 ? C.bad : C.warn, tag: 'wv:pauseTime' }); }
      } });
      if (stH > 0) B.push({ h: stH * s, gap: 12 * s, draw: (x, y, w) => picStage(x, y, w, stH * s, s, true) });
      // 0.8.17 (mykee: "Resume button should be below, right where the thumb is"): the road's pause page order: the
      // tiles, then Resume full width at the bottom of the page
      B.push(K.tiles([['wv:retry', 'Retry', ICON.retry, 'secondary'], ['wv:map', 'Map', ICON.grid, ui.faceOf('#1f9e94')]], s, 2));
      B.push({ h: 56 * s, gap: 12 * s, draw: (x, y, w) => ui.button('wv:resume', 'Resume', x, y, w, 56 * s, { kind: 'primary', shimmer: true, icon: ICON.play, size: 27 * s }) });
      return B;
    };
    const RIB = '#3a80ea';
    if (sd) {
      const card = K.page('Paused', build(0), { ...sd.cardO, ribbon: RIB });
      const { box } = K.stage(sd, card);
      picStage(box.x, box.y, box.w, box.h, u, false);
    } else K.page('Paused', build(roomFor(build, 100, 420)), { full: true, ribbon: RIB });
  }
  const SIDE_STAR0 = 0.3, SIDE_EGG0 = 0.95, SIDE_PILL = 1.25, SIDE_FLY = 1.6, SIDE_DONE = 2.4; // the side win page's beats (s)
  // 0.8.18 (mykee: "I want this screen to not have boundaries"): the win and fail pages are the road's frameless pages:
  // the scene (a noon sky, or a soft evening) edge to edge, her knoll, the meadow down to the buttons; the ribbon, the
  // stars, the eggs, the coins and the buttons float on it. Landscape: she stands on the left, the rest on the right.
  function drawSideEnd() {
    const g = S.game, A = ui.A, u = ui.u, z = env.size(), win = S.card === 'win', st = g.stats(), stars = g.stars(), calm = env.save().calm, P = S.pay;
    ui.calm = calm;
    const wide = A.w > A.h * 1.15, k = calm ? 1 : ease(S.cardT / 0.45), seed = S.level.id || 0;
    K.dim(0.6 + 0.14 * k);
    const near = st.target >= 2 && st.saved === st.target - 1, timeout = !win && !!g.timeLimit && g.timeLeft <= 0;
    const title = win ? (stars === 3 ? 'Perfect!' : stars === 2 ? 'Great job!' : 'Vault cracked!') : near ? 'So close!' : timeout ? 'Out of time!' : 'Too many eggs broke';
    const T = {}; // where her place is (the scene's knoll stands under it)
    const henT = Math.max(0, S.cardT - 0.25), R = wide; // R: on a wide screen every block but hers stands in the right column
    const ink = 'rgba(40,22,8,0.9)';
    const build = (stH) => (s) => {
      const B = [];
      // 0.8.17 win817 (the road's win page, one family): the stars slam onto their sockets, the eggs home pop in as one
      // line, the "+N" pill pops and its coins fly into the purse beside it; a tap skips to the end (pointerDown)
      if (win) B.push({ h: 96 * s, gap: 0, right: R, draw: (x, y, w) => {
        const Rr = 38 * s, sp = 100 * s, cx = x + w / 2;
        for (let i = 0; i < 3; i++) {
          const v = calm ? 9 : S.cardT - SIDE_STAR0 - i * 0.24, sx = cx + (i - 1) * sp, sy = y + Rr + 10 * s - (i === 1 ? 8 * s : 0);
          drawStar(ctx, sx, sy, Rr, false, 1, true);
          if (i >= stars) continue;
          if (v >= K.SLAM && !S['st' + i]) { S['st' + i] = 1; if (!calm && !S.skip) { audio.play('star', { intensity: i / 2, pitch: 1 + i * 0.12 }); if (env.buzz) env.buzz('star'); } }
          K.slam(sx, sy, Rr, v, calm || S.skip, i);
        }
        ui.record({ x: cx - sp - Rr, y: y + 2 * s, w: 2 * (sp + Rr), h: 2 * Rr + 10 * s }, 'wv:stars');
      } });
      else B.push({ h: 34 * s, gap: 4 * s, right: R, draw: (x, y, w) => { // why it failed: an icon and a few words, floating
        const t = near ? 'Just one egg short' : timeout ? 'No time left' : 'Too many eggs lost', tw = ui.measure(t, 20 * s) + 36 * s, x0 = x + w / 2 - tw / 2;
        if (near) drawEggIcon(ctx, x0 + 12 * s, y + 17 * s, 26 * s, 'alive'); else if (timeout) pictoClock(ctx, x0 + 12 * s, y + 17 * s, 30 * s); else pictoBroken(ctx, x0 + 12 * s, y + 17 * s, 30 * s);
        ui.text(t, x0 + 32 * s, y + 17 * s, { size: 20 * s, color: '#fff', stroke: ink, strokeW: 4 * s, maxW: w - 36 * s, tag: 'wv:cardline' });
      } });
      if (stH > 0) B.push({ h: stH * s, gap: (win ? 6 : 8) * s, at: (x, y, w) => { T.box = { x, y, w, h: stH * s }; T.henH = Math.min(0.685 * stH, wide ? 170 : 210) * s; }, draw: () => {
        drawCelebration(ctx, win ? S.cheer : 'encourage', henT, T.box, { pw: win ? routinePower(stars) : 0.5, calm, henH: T.henH, seed, clip: { x: 0, y: 0, w: z.W, h: z.H } });
        ui.record(T.box, 'wv:hen');
      } });
      // the eggs: one line of eggs (a win: popping in one by one; a fail: the slots, the ones home filled in, and the count)
      B.push({ h: (win ? 40 : 58) * s, gap: 8 * s, right: R, draw: (x, y, w) => {
        const n = win ? st.total : Math.max(1, st.target), saved = st.saved, sp = Math.min(40 * s, (w - 20 * s) / Math.max(1, n)), es = Math.min(32 * s, sp * 0.9), mid = x + w / 2;
        for (let i = 0; i < n; i++) { const q = !win || calm || S.skip ? 1 : clamp((S.cardT - SIDE_EGG0 - i * 0.07) / 0.25, 0, 1); if (q <= 0) continue; const ex = mid + (i - (n - 1) / 2) * sp, ey = y + 20 * s; ctx.save(); ctx.translate(ex, ey); ctx.scale(backOut(q), backOut(q)); drawEggIcon(ctx, 0, 0, es, i < saved ? 'saved' : 'slot'); ctx.restore(); }
        ui.record({ x: mid - (n * sp) / 2, y: y + 20 * s - es / 2, w: n * sp, h: es }, 'wv:eggs');
        if (!win) ui.text(`${saved}/${n}`, mid, y + 47 * s, { size: 18 * s, align: 'center', maxW: w - 16 * s, color: '#fff', stroke: ink, strokeW: 3.5 * s, tag: 'wv:eggsn' });
      } });
      if (win && P) B.push({ h: 48 * s, gap: 10 * s, right: R, draw: (x, y, w) => { // what it paid, then its coins fly into the purse beside it
        const k0 = calm || S.skip ? 1 : clamp((S.cardT - SIDE_PILL) / 0.3, 0, 1);
        ctx.save(); if (k0 < 1) ctx.globalAlpha = ui.aBase = k0; // (0.8.18: the purse comes with the pill, not alone on the meadow)
        const Rw = K.coinRow(x + w / 2, y + 24 * s, 42 * s, s, { txt: '+' + P.coins, k: k0, tag: 'wv:pay' });
        ctx.restore(); ui.aBase = 1;
        if (!S.flown && (calm || S.skip || S.cardT > SIDE_FLY)) { S.flown = true; if (env.coinsFly) env.coinsFly(P, Rw.pill, 0.5); if (calm || S.skip) K.settle(); }
      } });
      if (win) B.push({ h: 70 * s, gap: 12 * s, right: R, draw: (x, y, w) => { // Map big and thick in the thumb zone, Again small beside it
        const rw = w * 0.3;
        ui.button('wv:retry', 'Again', x, y, rw, 70 * s, { kind: 'secondary', icon: ICON.retry, size: 18 * s });
        ui.button('wv:map', 'Map', x + rw + 10 * s, y, w - rw - 10 * s, 70 * s, { kind: 'primary', icon: ICON.grid, size: 30 * s });
      } });
      else {
        B.push({ h: 68 * s, gap: 14 * s, right: R, draw: (x, y, w) => ui.button('wv:retry', 'RETRY', x, y, w, 68 * s, { kind: 'primary', shimmer: true, icon: ICON.retry, size: 27 * s }) });
        B.push({ h: 58 * s, gap: 12 * s, right: R, draw: (x, y, w) => ui.button('wv:map', 'Map', x, y, w, 58 * s, { kind: 'tertiary', icon: ICON.grid, size: 18 * s }) });
      }
      return B;
    };
    const RIB = win ? '#f0542e' : near ? '#e0882a' : '#5a82c8';
    const rest = build(0)(1).reduce((a, b) => a + (b.gap ?? 10) + b.h, 0), stH = wide ? Math.max(90, (A.h - 18 * u) / u - 16) : clamp((A.h - 18 * u) / u - K.bareHead() - rest - 6, win ? 110 : 130, 460); // (her place takes what the rest leaves)
    const o = { ribbon: RIB, ...(wide ? { twoCol: true, maxW: Math.min(A.w - 32 * u, 900 * u) } : {}) };
    K.bare(title, build(stH), { ...o, hidden: true });
    K.scene(K.sceneAt(T.box, T.henH), k, win);
    if (win) K.feathers(0.5 * k);
    // the page rises from below (landscape: from the right); the scene fades in under it
    K.bare(title, build(stH), { ...o, ...(wide ? { dx: (1 - k) * z.W * 0.5 } : { dy: (1 - k) * z.H * 0.5 }) });
  }

  // ---------------------------------------------------------------- the Extras screen (menu): Wonder Vaults + Practice
  // One column of wide row cards (two columns on a wide screen): a big picture tile on the left, the name and its one
  // line, the stars on the right. Wonder Vaults (bonus) first, then Practice under its own heading in the same row style.
  // The rows grow to fill the page; when they cannot fit at their smallest height the page scrolls (env.glide, as Practice).
  const TILE = { planet: '#5a6ad8', plan: '#3f9fd0', mama: '#d8862a', twin: '#3fa86a', hatch: '#e0a81c', practice: '#3fae4a', album: '#c0558a' };
  function drawExtras() {
    const z = env.size(), A = ui.A, u = ui.u, t = env.time(), sv = env.save(), SC = env.escroll();
    ui.calm = sv.calm;
    const dt = clamp(t - (SC.t || t), 0, 0.1); SC.t = t;
    const bg = ctx.createLinearGradient(0, 0, 0, z.H);
    bg.addColorStop(0, '#1c1440'); bg.addColorStop(1, '#3a2152');
    ctx.globalAlpha = 0.96; ctx.fillStyle = bg; ctx.fillRect(0, 0, z.W, z.H); ctx.globalAlpha = 1;
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 16 * u; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(z.W * 0.86, z.H * 0.9, Math.min(z.W, z.H) * (0.22 + 0.15 * i), 2.4 + i * 0.5 + (sv.calm ? 0 : t * 0.03 * (i % 2 ? -1 : 1)), 5.6 + i * 0.4 + (sv.calm ? 0 : t * 0.03 * (i % 2 ? -1 : 1))); ctx.stroke(); }
    ctx.restore();
    // layout: the list's viewport, the column(s), and the row height
    // (0.8.14: the header and the rows share one column, ui.pageBox / ui.pageHeader, like every other page)
    const wide = A.w > A.h * 1.15, cols = wide ? 2 : 1, colGap = 12 * u, headH = 30 * u;
    const P = ui.pageBox(wide ? 860 * u : 460 * u), pad = P.pad, vt = P.bottom + 8 * P.s, vb = A.y1;
    const listW = P.w, rowW0 = wide ? listW : (listW - colGap * (cols - 1)) / cols, lx = P.x; // (0.8.17: a wide page lays its sections side by side, below)
    // 0.8.17: the combo album (env.album, main.js) sits under Practice in the same row style, its own heading
    const AL = env.album ? env.album() : null, nSec = AL ? 3 : 2;
    // 0.8.17: the vaults are side quests on the map now; one row leads there (main.js 'xs:side': the first open one)
    const n = 1, wvRows = 1, nRows = wvRows + 1 + (AL ? 1 : 0);
    // frame818 (owner: no empty bands, even gaps): upright, the rows share the whole safe height, one equal gap g0 above the
    // first heading, between the sections and under the last row; a short phone that cannot fit them at 84 units scrolls
    const g0 = clamp((vb - vt) * 0.028, 12 * u, 24 * u);
    const rowH0 = wide ? 108 * u : Math.max(84 * u, (vb - vt - nSec * headH - (nSec + 1) * g0) / nRows);
    const gap = g0, secGap = g0;
    const total = wide ? vb - vt : (nSec + 1) * g0 + nSec * headH + nRows * rowH0;
    SC.max = Math.max(0, total - (vb - vt));
    env.glide(SC, dt);
    // the list, clipped under the header
    ctx.save(); ctx.beginPath(); ctx.rect(0, vt, z.W, vb - vt); ctx.clip();
    let y = vt - SC.y + (wide ? 4 * u : g0);
    const out = (yy, hh) => yy < vt || yy + hh > vb;
    const head = (txt, yy, tag, chip, hx = lx) => {
      const tw = ui.measure(txt, 18 * u), cw2 = chip ? ui.measure(chip, 11 * u) + 16 * u : 0, nr = out(yy, headH);
      ui.text(txt, hx + 4 * u, yy + headH / 2 - 1 * u, { size: 18 * u, color: '#ffe8b0', stroke: 'rgba(20,8,30,0.7)', strokeW: 3 * u, tag, noRecord: nr });
      if (chip) { const cx0 = hx + 4 * u + tw + 8 * u; ui.roundRect(cx0, yy + headH / 2 - 10 * u, cw2, 19 * u, 9.5 * u); ctx.fillStyle = '#ffd24a'; ctx.fill(); ui.text(chip, cx0 + cw2 / 2, yy + headH / 2 + 0.5 * u, { size: 11 * u, align: 'center', color: '#5a2a08', tag: tag + ':chip', noRecord: nr }); }
    };
    const row = (L, x, ry, rowW = rowW0, rowH = rowH0, vert = false) => {
      const prac = !!L.practice || !!L.album || !!L.side, s = prac ? 0 : starsOf(L.key), key = L.side ? 'twin' : L.album ? 'album' : prac ? 'practice' : L.key, face = ui.faceOf(L.side ? '#8a5ad8' : TILE[key] || '#8a5ad8');
      const part = out(ry, rowH), n0 = ui.rects.length, nb = ui.buttons.length, id = L.side ? 'sq:bonus' : L.album ? 'xs:album' : prac ? 'practice' : 'wv:play:' + L.key, grp = 'btn:' + id;
      const b = ui.button(id, '', x, ry, rowW, rowH, { face, keepFace: true, round: 18 * u });
      const fy = ry + b.dy, fh = rowH - Math.min(6 * u, rowH * 0.13), ts = Math.min(fh - 14 * u, Math.max(140 * u, rowW * 0.36), rowW * 0.36) /* frame818: a tall row's picture grows with it */, tx = x + Math.min(8 * u + (fh - ts) / 2 - 3 * u, 20 * u);
      if (vert) { // 0.8.17 landscape: a tall tile per section, the picture big on top, the words and the stars (or the arrow) under it
        const ns = clamp(rowW * 0.08, 19 * u, 25 * u), ps = clamp(rowW * 0.055, 13 * u, 16 * u), lines = wrapText(L.pitch, ps, rowW - 28 * u).slice(0, 2), foot = 34 * u;
        const wordsH = ns * 1.2 + 4 * u + lines.length * ps * 1.2, vts = Math.max(40 * u, Math.min(rowW * 0.62, fh - wordsH - foot - 34 * u, 190 * u)), blk = vts + 12 * u + wordsH + 10 * u + foot, y0 = fy + (fh - blk) / 2, cx = x + rowW / 2;
        if (L.album) env.albumIcon(ctx, cx, y0 + vts / 2, vts, t); else drawExtraIcon(ctx, key, cx, y0 + vts / 2, vts, t, { calm: sv.calm });
        const wy = y0 + vts + 12 * u;
        ui.text(L.name, cx, wy + ns * 0.58, { size: ns, align: 'center', color: '#fff', stroke: face.line, strokeW: 3 * u, group: grp, tag: 'wvname:' + key, maxW: rowW - 20 * u });
        lines.forEach((l, i) => ui.text(l, cx, wy + ns * 1.2 + 4 * u + ps * 0.6 + i * ps * 1.2, { size: ps, align: 'center', color: 'rgba(255,255,255,0.9)', group: grp, tag: 'wvpitch:' + key + i, maxW: rowW - 20 * u }));
        const fcy = wy + wordsH + 10 * u + foot / 2, sr = 9 * u;
        if (prac) { ctx.beginPath(); ctx.arc(cx, fcy, 15 * u, 0, 7); ctx.fillStyle = 'rgba(30,10,0,0.3)'; ctx.fill(); ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.4 * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(cx - 3 * u, fcy - 7 * u); ctx.lineTo(cx + 4 * u, fcy); ctx.lineTo(cx - 3 * u, fcy + 7 * u); ctx.stroke(); ctx.restore(); }
        else { ui.roundRect(cx - sr * 4.3, fcy - sr * 1.45, sr * 8.6, sr * 2.9, sr * 1.45); ctx.fillStyle = 'rgba(30,10,0,0.3)'; ctx.fill(); for (let q = 0; q < 3; q++) drawStar(ctx, cx + (q - 1) * sr * 2.65, fcy, sr, q < s); }
        if (L.album && L.fresh) env.albumMark(x + rowW - 6 * u, ry + 6 * u, rowH);
        if (L.album && env.albumLead) env.albumLead(SC, ry + SC.y - vt, { x, y: ry, w: rowW, h: rowH }, vb - vt);
        return;
      }
      if (L.album) env.albumIcon(ctx, tx + ts / 2, fy + fh / 2, ts, t); else drawExtraIcon(ctx, key, tx + ts / 2, fy + fh / 2, ts, t, { calm: sv.calm });
      // the right edge: three stars on a dark pill, or a round chevron for Practice
      const sr = Math.min(8.5 * u, rowW / 40), pillW = sr * 8.6, rightW = prac ? 30 * u : pillW;
      const rx = x + rowW - 14 * u - rightW / 2, cy = fy + fh / 2;
      if (prac) {
        ctx.beginPath(); ctx.arc(rx, cy, 15 * u, 0, 7); ctx.fillStyle = 'rgba(30,10,0,0.3)'; ctx.fill();
        ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.4 * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(rx - 3 * u, cy - 7 * u); ctx.lineTo(rx + 4 * u, cy); ctx.lineTo(rx - 3 * u, cy + 7 * u); ctx.stroke(); ctx.restore();
      } else {
        ui.roundRect(rx - sr * 4.3, cy - sr * 1.45, sr * 8.6, sr * 2.9, sr * 1.45); ctx.fillStyle = 'rgba(30,10,0,0.3)'; ctx.fill();
        for (let q = 0; q < 3; q++) drawStar(ctx, rx + (q - 1) * sr * 2.65, cy, sr, q < s);
      }
      // the words, between the picture and the right edge; the one line wraps to a second rather than shrink
      const ttx = tx + ts + 12 * u, tw = x + rowW - 14 * u - rightW - 8 * u - ttx, ns = clamp(rowH * 0.13, 19 * u, 24 * u), ps = clamp(rowH * 0.085, 12.5 * u, 15 * u), lines = wrapText(L.pitch, ps, tw).slice(0, 2); // (a tall row's words grow with it)
      const blockH = ns * 1.16 + 4 * u + lines.length * ps * 1.2, top = fy + (fh - blockH) / 2;
      ui.text(L.name, ttx, top + ns * 0.58, { size: ns, color: '#fff', stroke: face.line, strokeW: 3 * u, group: grp, tag: 'wvname:' + key, maxW: tw });
      lines.forEach((l, i) => ui.text(l, ttx, top + ns * 1.16 + 4 * u + ps * 0.6 + i * ps * 1.2, { size: ps, color: 'rgba(255,255,255,0.9)', group: grp, tag: 'wvpitch:' + key + i, maxW: tw }));
      if (L.album && L.fresh && !part) env.albumMark(x + rowW - 6 * u, ry + 6 * u, rowH); // a new find: the mark leads into the album, to its tile
      if (L.album && env.albumLead) env.albumLead(SC, ry + SC.y - vt, { x, y: ry, w: rowW, h: rowH }, vb - vt); // home's mark: the page lands on this row and rings it
      if (part) { // a row cut by the list edge records nothing for the overlap check and taps only inside the list
        ui.rects.length = n0;
        const bt = ui.buttons[nb]; if (bt) { const t2 = Math.max(bt.y, vt), b2 = Math.min(bt.y + bt.h, vb); if (b2 - t2 < 8 * u) ui.buttons.length = nb; else { bt.y = t2; bt.h = b2 - t2; } }
      }
    };
    // 0.8.17 (mykee: landscape "too much empty UI space"; the one column used half the width): on its side each section
    // is a column of its own, its heading over one tall tile, the three side by side over the page's whole width and height
    const SECS = [['Wonder Vaults', 'extras:wv', 'BONUS', { side: true, key: '_side', name: 'Bonus vaults', pitch: 'Side quests on the map' }], ['Practice', 'extras:practice', null, { practice: true, key: '_practice', name: 'Practice', pitch: 'Try any villain or power' }],
      ...(AL ? [['Collection', 'extras:album', `${AL.n} / ${AL.total}`, { album: true, key: '_album', name: 'Combo album', pitch: AL.pitch, fresh: AL.fresh }]] : [])];
    if (wide) {
      const cw = (listW - colGap * (SECS.length - 1)) / SECS.length, rh = vb - vt - 4 * u - headH - 6 * u - Math.max(pad, 12 * u);
      SECS.forEach(([txt, tag, chip, L], i) => { const x = lx + i * (cw + colGap); head(txt, vt + 4 * u, tag, chip, x); row(L, x, vt + 4 * u + headH + 6 * u, cw, rh, true); });
    } else {
    head('Wonder Vaults', y, 'extras:wv', 'BONUS');
    y += headH;
    row({ side: true, key: '_side', name: 'Bonus vaults', pitch: 'Side quests on the map' }, lx, y);
    y += wvRows * rowH0 + (wvRows - 1) * gap + secGap;
    head('Practice', y, 'extras:practice');
    y += headH;
    row({ practice: true, key: '_practice', name: 'Practice', pitch: 'Try any villain or power' }, lx, y);
    if (AL) {
      y += rowH0 + secGap;
      head('Collection', y, 'extras:album', `${AL.n} / ${AL.total}`);
      y += headH;
      row({ album: true, key: '_album', name: 'Combo album', pitch: AL.pitch, fresh: AL.fresh }, lx, y);
    }
    }
    ctx.restore();
    // the header band over the list: back, title, stars
    ctx.fillStyle = '#1c1440'; ctx.globalAlpha = 0.94; ctx.fillRect(0, 0, z.W, vt - 4 * u); ctx.globalAlpha = 1;
    const g2 = ctx.createLinearGradient(0, vt - 4 * u, 0, vt + 10 * u); g2.addColorStop(0, 'rgba(10,4,24,0.55)'); g2.addColorStop(1, 'rgba(10,4,24,0)'); ctx.fillStyle = g2; ctx.fillRect(0, vt - 4 * u, z.W, 14 * u);
    const SD = env.sideStars ? env.sideStars() : { have: WONDER_LEVELS.reduce((a, L) => a + starsOf(L.key), 0), max: WONDER_LEVELS.length * 3 }, starTxt = `${SD.have} / ${SD.max}`, hs = P.s, stw = ui.measure(starTxt, 17 * hs);
    const chipW = 10 * hs + 20 * hs + 5 * hs + stw + 12 * hs;
    ui.pageHeader(P, { back: 'back', title: 'Extras', color: '#8a5ad8', tag: 'extras:title', right: { w: chipW, draw: (x, y, w, h) => {
      const ch = h - 6 * hs, cy = y + 2 * hs + ch / 2; // the ribbon's band: one centre line
      ui.glass(x, cy - ch / 2, w, ch);
      drawStar(ctx, x + 10 * hs + 10 * hs, cy, 9.5 * hs, true);
      ui.text(starTxt, x + w - 12 * hs, cy + 0.5 * hs, { size: 17 * hs, color: '#fff', align: 'right', stroke: 'rgba(30,14,4,0.7)', strokeW: 3 * hs, tag: 'extras:stars' });
    } } });
    if (SC.max > 0 && !sv.calm) { // a thin scroll thumb
      const th = Math.max(30 * u, (vb - vt) * (vb - vt) / total), ty2 = vt + clamp(SC.y / SC.max, 0, 1) * (vb - vt - th - 4 * u);
      ui.roundRect(A.x1 - 5 * u, ty2, 3 * u, th, 1.5 * u); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
    }
  }

  return { start, back, wheel, has: (k) => !!wonderByKey(k), update, render, pointerDown, pointerMove, pointerUp, press, drawExtras, resize() { S.snap = true; if (S.backdrop) { const z = env.size(); S.backdrop.resize(z.W, z.H, z.DPR); } }, get state() { return S; }, LEVELS: WONDER_LEVELS, toScreen, starsOf };
}
