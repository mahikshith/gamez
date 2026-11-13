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
import { ICON, drawStar, drawEggIcon } from './ui/ui.js';
import { drawSpace, drawPlanet, drawSun, drawRail, drawPull, drawLamp, drawBolts, drawTurnArrow, drawFrost, drawStopClock, drawHand } from './render/wonder.js';

export function createWonder(env) {
  const { ctx, ui, audio } = env;
  const S = { level: null, game: null, t: 0, fx: [], cam: { x: 0, y: 0, k: 40 }, held: new Map(), card: null, cardT: 0, endT: 0, hens: [], touched: false, hatched: false, slow: 1, lastBump: 0, frost: 1, overT: 0, off: [], tipT: 0, arrows: [] };
  const space = () => S.game && (S.game.kind === 'planet' || S.game.kind === 'mama');
  const starsOf = (key) => (env.save().wonder || {})[key] || 0;

  function start(key) {
    const L = wonderByKey(key);
    if (!L) return false;
    S.level = L;
    S.game = new WonderGame(L);
    S.theme = THEMES.find((t) => t.id === L.theme) || THEMES[0];
    S.backdrop = createBackdrop(S.theme, L.id * 97);
    const z = env.size();
    S.backdrop.resize(z.W, z.H, z.DPR);
    S.fx = S.game.sims.map(() => new FX());
    S.hens = S.game.sims.map(() => ({ mood: 'idle', t: 0, face: 1 }));
    S.t = 0; S.card = null; S.cardT = 0; S.endT = 0; S.touched = false; S.hatched = false; S.slow = 1; S.snap = true; S.overT = 0; S.tipT = 4.5; S.acc = 0;
    S.held.clear();
    S.frost = S.game.kind === 'plan' ? 1 : 0;
    W.setSkin(env.save().wallet.skin);
    audio.setMaterial(L.material || 'wood'); audio.setUnderwater(false); audio.setWind(0); audio.setFireLoop(false);
    audio.music(S.theme.music);
    env.setScreen('wonder');
    return true;
  }
  function quit() {
    for (const h of S.held.values()) h.ring.held = false;
    S.held.clear();
    audio.setRingTurn(0);
    env.leave();
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
  function playRect() {
    const z = env.size(), u = ui.u, top = 62 * u, bot = (S.game.kind === 'plan' ? 86 : 10) * u;
    return { x: 0, y: top, w: z.W, h: z.H - top - bot };
  }
  function camera(dt) {
    const B = stage(), P = playRect(), g = S.game;
    let T = { x: (B.x0 + B.x1) / 2, y: (B.y0 + B.y1) / 2, k: Math.min(P.w / (B.x1 - B.x0), P.h / (B.y1 - B.y0)) };
    // plan: while it plays out the camera leans in on the egg furthest along (never losing the nest)
    if (g.kind === 'plan' && g.phase !== 'plan' && g.state === 'play') {
      const sim = g.sim, eggs = sim.aliveEggs();
      if (eggs.length) {
        let lead = eggs[0];
        for (const e of eggs) if (sim.channelOf(e) > sim.channelOf(lead) || (sim.channelOf(e) === sim.channelOf(lead) && e.body.getPosition().y < lead.body.getPosition().y)) lead = e;
        const p = lead.body.getPosition(), k = T.k * 1.3, hw = P.w / (2 * k), hh = P.h / (2 * k);
        T = { x: clamp(lerp(T.x, p.x, 0.6), Math.min(B.x0 + hw, T.x), Math.max(B.x1 - hw, T.x)), y: clamp(lerp(T.y, p.y, 0.6), Math.min(B.y0 + hh, T.y), Math.max(B.y1 - hh, T.y)), k };
      }
    }
    const c = S.cam;
    if (S.snap || env.save().calm) { c.x = T.x; c.y = T.y; c.k = T.k; S.snap = false; }
    else { const a = 1 - Math.exp(-dt * 3.2); c.x += (T.x - c.x) * a; c.y += (T.y - c.y) * a; c.k *= Math.exp(Math.log(T.k / c.k) * a); }
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
    if (!g || S.card || g.state !== 'play') return;
    const x = e.clientX, y = e.clientY, si = vaultAt(x, y), w = toWorld(si, x, y);
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
    const h = S.held.get(e.pointerId), g = S.game;
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
    if (id === 'wv:quit') quit();
    else if (id === 'wv:retry') start(S.level.key);
    else if (id === 'wv:next') { const i = WONDER_LEVELS.indexOf(S.level), N = WONDER_LEVELS[i + 1]; if (N) start(N.key); else quit(); }
    else if (id === 'wv:hatch') { if (g.hatch()) { S.hatched = true; audio.play('unlock'); for (const h of S.held.values()) if (h.ring) h.ring.held = false; S.held.clear(); } }
    else if (id === 'wv:rewind') { if (g.rewind()) rebuilt(); }
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
        S.card = g.state === 'won' ? 'win' : 'fail'; S.cardT = 0;
        for (const h of S.held.values()) if (h.ring) h.ring.held = false;
        S.held.clear();
        if (g.state === 'won') {
          const sv = env.save(), st = g.stars();
          sv.wonder = sv.wonder || {};
          if (st > (sv.wonder[S.level.key] || 0)) { sv.wonder[S.level.key] = st; env.persist(); }
        } else audio.play('level_fail');
      }
    }
    if (S.card) S.cardT += dt;
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
    drawHUD();
    if (S.card) drawCard();
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
    const g = S.game, z = env.size(), u = ui.u, pad = 10 * u, st = g.stats(), L = S.level;
    ui.calm = env.save().calm;
    ui.button('wv:quit', '', pad, pad, 44 * u, 44 * u, { kind: 'hud', icon: ICON.left, iconS: 1.3, round: 14 * u });
    // right: eggs home (per vault) and the clock (or the attempt count)
    const eggsTxt = st.per.map((p) => `${p.saved}/${p.target}`).join('  '), right = g.kind === 'plan' ? `Try ${st.attempts}` : fmt(g.timeLeft);
    const ew = ui.measure(eggsTxt, 17 * u), rw = ui.measure(g.kind === 'plan' ? 'Try 88' : '0:00', 17 * u), cw = 30 * u + ew + 14 * u + rw + 14 * u, cx = z.W - pad - cw, cy = pad + 22 * u;
    ui.glass(cx, cy - 19 * u, cw, 38 * u);
    drawEggIcon(ctx, cx + 17 * u, cy, 11 * u, 'ok');
    ui.text(eggsTxt, cx + 30 * u, cy + 0.5 * u, { size: 17 * u, color: '#fff', stroke: 'rgba(30,14,4,0.7)', strokeW: 3 * u, tag: 'wv:eggs' });
    ui.text(right, cx + cw - 14 * u, cy + 0.5 * u, { size: 17 * u, align: 'right', color: g.timeLimit && g.timeLeft < 10 ? '#ff8a6a' : '#ffe9a8', stroke: 'rgba(30,14,4,0.7)', strokeW: 3 * u, tag: 'wv:clock' });
    const tl = pad + 44 * u + 10 * u, trr = cx - 10 * u;
    if (trr - tl > 70 * u) ui.text(L.name, (tl + trr) / 2, cy + 0.5 * u, { size: 19 * u, align: 'center', color: '#fff', stroke: 'rgba(30,14,4,0.75)', strokeW: 4 * u, shadow: 'rgba(30,14,4,0.6)', tag: 'wv:name', maxW: trr - tl });
    // plan: HATCH / REWIND and the stopped clock
    if (g.kind === 'plan' && !S.card) {
      const bw = Math.min(250 * u, z.W - 110 * u), bh = 60 * u, bx = z.W / 2 - bw / 2 + 22 * u, by = z.H - bh - 14 * u;
      drawStopClock(ctx, bx - 34 * u, by + bh * 0.45, 40 * u, g.phase === 'plan');
      ui.record({ x: bx - 56 * u, y: by + bh * 0.45 - 22 * u, w: 44 * u, h: 44 * u }, 'wv:clockicon');
      if (g.phase === 'plan') ui.button('wv:hatch', 'HATCH', bx, by, bw, bh, { kind: 'primary', shimmer: S.touched, icon: ICON.play, size: 26 * u, round: 18 * u });
      else if (g.state === 'play') ui.button('wv:rewind', 'REWIND', bx, by, bw, bh, { kind: 'secondary', icon: ICON.retry, size: 22 * u, round: 18 * u });
    }
    // the tip: one line at the start, gone on the first touch
    if (S.tipT > 0 && L.tip && !S.card) {
      const a = clamp(S.tipT / 0.5, 0, 1) * clamp(S.t / 0.4, 0, 1), ts = 14 * u, mw = Math.min(z.W - 28 * u, 520 * u), lines = wrapText(L.tip, ts, mw - 28 * u);
      const h = lines.length * ts * 1.3 + 16 * u, w = Math.max(...lines.map((l) => ui.measure(l, ts))) + 28 * u, x = z.W / 2 - w / 2, y = 66 * u;
      ctx.save(); ctx.globalAlpha = a; ui.aBase = a;
      ui.glass(x, y, w, h, { r: 14 * u });
      lines.forEach((l, i) => ui.text(l, z.W / 2, y + 8 * u + ts * 0.65 + i * ts * 1.3, { size: ts, align: 'center', color: '#fff', tag: 'wv:tip' + i, group: 'wv:tip' }));
      ui.aBase = 1; ctx.restore();
    }
  }
  function wrapText(text, size, maxW) {
    const out = []; let cur = '';
    for (const w of text.split(' ')) { const tr = cur ? cur + ' ' + w : w; if (ui.measure(tr, size) > maxW && cur) { out.push(cur); cur = w; } else cur = tr; }
    if (cur) out.push(cur);
    return out;
  }

  function drawCard() {
    const g = S.game, z = env.size(), u = ui.u, win = S.card === 'win', st = g.stats(), stars = g.stars(), L = S.level;
    const a = clamp(S.cardT / 0.25, 0, 1);
    ctx.fillStyle = `rgba(10,6,20,${0.5 * a})`; ctx.fillRect(0, 0, z.W, z.H);
    const w = Math.min(330 * u, z.W - 28 * u), h = (win ? 268 : 220) * u, x = z.W / 2 - w / 2, y = z.H / 2 - h / 2 + (1 - a) * 20 * u;
    ctx.save(); ctx.globalAlpha = a; ui.aBase = a;
    ui.frame(x, y, w, h, {});
    ui.ribbon(win ? L.name : 'So close!', z.W / 2, y - 16 * u, Math.min(w - 20 * u, 270 * u), 40 * u, { color: win ? '#e8503a' : '#6c7aa0', size: 21 * u, tag: 'wv:cardtitle' });
    let cy = y + 62 * u;
    if (win) {
      for (let i = 0; i < 3; i++) { const on = i < stars && S.cardT > 0.35 + i * 0.28, p = on ? clamp((S.cardT - 0.35 - i * 0.28) / 0.25, 0, 1) : 1; drawStar(ctx, z.W / 2 + (i - 1) * 62 * u, cy + (i === 1 ? -6 * u : 0), (i === 1 ? 29 : 24) * u * (on ? 0.7 + 0.3 * (1 + 0.6 * Math.sin(p * Math.PI)) * 1 : 1), on, p); }
      ui.record({ x: z.W / 2 - 90 * u, y: cy - 36 * u, w: 180 * u, h: 66 * u }, 'wv:stars');
      cy += 56 * u;
    }
    const line = g.kind === 'plan' ? (win ? `Solved on try ${st.attempts}` : 'The eggs did not make it') : `${st.saved} of ${st.total} home`;
    ui.text(line, z.W / 2, cy, { size: 19 * u, align: 'center', color: '#5a3416', tag: 'wv:cardline', maxW: w - 30 * u });
    const sub = win ? (stars === 3 ? 'Perfect!' : g.kind === 'plan' ? `3 stars: solve it in ${(L.wonder.par || [2])[0]} tries` : st.broken ? '2 stars: lose no egg' : '3 stars: not a single crack') : g.kind === 'twin' ? 'Save an egg from each vault' : `Bring ${st.target} home`;
    ui.text(sub, z.W / 2, cy + 26 * u, { size: 14 * u, align: 'center', color: '#8a6238', tag: 'wv:cardsub', maxW: w - 30 * u });
    const by = y + h - 70 * u, bh = 52 * u, gap = 10 * u, bw = (w - 36 * u - gap) / 2, hasNext = win && WONDER_LEVELS.indexOf(L) < WONDER_LEVELS.length - 1;
    ui.button('wv:quit', 'Vaults', x + 18 * u, by, bw, bh, { kind: 'secondary', icon: ICON.grid, size: 17 * u });
    if (hasNext) ui.button('wv:next', 'Next', x + 18 * u + bw + gap, by, bw, bh, { kind: 'primary', icon: ICON.play, size: 19 * u, shimmer: true });
    else ui.button('wv:retry', win ? 'Again' : 'Retry', x + 18 * u + bw + gap, by, bw, bh, { kind: win ? 'secondary' : 'primary', icon: ICON.retry, size: 18 * u });
    ui.aBase = 1; ctx.restore();
  }

  // ---------------------------------------------------------------- the Extras screen (menu): Wonder Vaults + Practice
  const TILE = { planet: '#5a6ad8', plan: '#3f9fd0', mama: '#d8862a', twin: '#3fa86a', hatch: '#e0a81c' };
  function drawExtras() {
    const z = env.size(), u = ui.u, pad = 14 * u, t = env.time(), sv = env.save();
    ui.calm = sv.calm;
    const bg = ctx.createLinearGradient(0, 0, 0, z.H);
    bg.addColorStop(0, '#1c1440'); bg.addColorStop(1, '#3a2152');
    ctx.globalAlpha = 0.96; ctx.fillStyle = bg; ctx.fillRect(0, 0, z.W, z.H); ctx.globalAlpha = 1;
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 16 * u; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(z.W * 0.86, z.H * 0.9, Math.min(z.W, z.H) * (0.22 + 0.15 * i), 2.4 + i * 0.5 + (sv.calm ? 0 : t * 0.03 * (i % 2 ? -1 : 1)), 5.6 + i * 0.4 + (sv.calm ? 0 : t * 0.03 * (i % 2 ? -1 : 1))); ctx.stroke(); }
    ctx.restore();
    const hy = pad + 23 * u;
    ui.button('back', '', pad, pad, 46 * u, 46 * u, { kind: 'hud', icon: ICON.left, iconS: 1.3, round: 15 * u });
    const total = WONDER_LEVELS.reduce((a, L) => a + starsOf(L.key), 0), starTxt = `${total} / ${WONDER_LEVELS.length * 3}`, stw = ui.measure(starTxt, 17 * u);
    const chipW = 9 * u + 22 * u + 4 * u + stw + 12 * u, chipX = z.W - pad - chipW;
    ui.glass(chipX, hy - 18 * u, chipW, 36 * u);
    drawStar(ctx, chipX + 20 * u, hy, 9.5 * u, true);
    ui.text(starTxt, z.W - pad - 12 * u, hy + 0.5 * u, { size: 17 * u, align: 'right', color: '#fff', stroke: 'rgba(30,14,4,0.7)', strokeW: 3 * u, tag: 'extras:stars' });
    const tl = pad + 68 * u, trr = chipX - 22 * u;
    ui.ribbon('Extras', (tl + trr) / 2, hy - 19 * u, clamp(140 * u, 90 * u, trr - tl), 36 * u, { color: '#8a5ad8', size: 21 * u, tag: 'extras:title' });
    const labBlock = 0; // Practice is a tile in the same grid as the vaults
    // section: Wonder Vaults (BONUS)
    let y = 74 * u;
    const head = (txt, yy, tag, chip) => {
      const tw = ui.measure(txt, 17 * u), cw2 = chip ? ui.measure(chip, 11 * u) + 16 * u : 0, x0 = z.W / 2 - (tw + (chip ? 8 * u + cw2 : 0)) / 2;
      ui.text(txt, x0, yy, { size: 17 * u, color: '#ffe8b0', stroke: 'rgba(20,8,30,0.7)', strokeW: 3 * u, tag });
      if (chip) { ui.roundRect(x0 + tw + 8 * u, yy - 9 * u, cw2, 18 * u, 9 * u); ctx.fillStyle = '#ffd24a'; ctx.fill(); ui.text(chip, x0 + tw + 8 * u + cw2 / 2, yy + 0.5 * u, { size: 11 * u, align: 'center', color: '#5a2a08', tag: tag + ':chip' }); }
    };
    head('Wonder Vaults', y + 9 * u, 'extras:wv', 'BONUS');
    y += 28 * u;
    const ITEMS = [...WONDER_LEVELS, { practice: true, key: '_practice', name: 'Practice', pitch: 'Try any villain or power' }], n = ITEMS.length, cols = z.W > z.H ? n : z.W < 420 ? 2 : 3, rows = Math.ceil(n / cols), gap = 10 * u;
    const cw = Math.min((z.W - 2 * pad - gap * (cols - 1)) / cols, 150 * u), room = z.H - y - pad - labBlock, chh = Math.min((room - gap * (rows - 1)) / rows, cw * 0.92, 150 * u);
    ITEMS.forEach((L, i) => {
      const r = Math.floor(i / cols), inRow = r === rows - 1 ? n - cols * (rows - 1) : cols, c = i - r * cols;
      const rowW = inRow * cw + (inRow - 1) * gap, x = z.W / 2 - rowW / 2 + c * (cw + gap), ty = y + r * (chh + gap), s = L.practice ? 0 : starsOf(L.key), face = ui.faceOf(L.practice ? '#3fae4a' : TILE[L.key] || '#8a5ad8');
      const b = ui.button(L.practice ? 'practice' : 'wv:play:' + L.key, '', x, ty, cw, chh, { face, keepFace: true, round: 18 * u });
      const fy = ty + b.dy, fh = chh - Math.min(6 * u, chh * 0.13), mx = x + cw / 2, grp = L.practice ? 'btn:practice' : 'btn:wv:play:' + L.key;
      const tall = fh > 96 * u;
      if (L.practice) ICON.grid(ctx, mx, fy + fh * (tall ? 0.24 : 0.27), Math.min(30 * u, fh * 0.3));
      else ui.text(String(i + 1), mx, fy + fh * (tall ? 0.24 : 0.27), { size: Math.min(30 * u, fh * 0.3), align: 'center', color: '#fff', stroke: face.line, strokeW: 4 * u, shadow: face.line, group: grp, tag: 'wvnum' + i });
      ui.text(L.name, mx, fy + fh * (tall ? 0.5 : 0.56), { size: Math.min(15 * u, fh * 0.15), align: 'center', color: '#fff', stroke: face.line, strokeW: 3 * u, group: grp, tag: 'wvname' + i, maxW: cw - 12 * u });
      if (tall) ui.text(L.pitch, mx, fy + fh * 0.66, { size: 10.5 * u, align: 'center', color: 'rgba(255,255,255,0.85)', group: grp, tag: 'wvpitch' + i, maxW: cw - 12 * u });
      if (L.practice) return;
      const sr = Math.min(8.5 * u, cw / 12, fh * 0.1), sy = fy + fh * 0.85;
      ui.roundRect(mx - sr * 4.3, sy - sr * 1.45, sr * 8.6, sr * 2.9, sr * 1.45); ctx.fillStyle = 'rgba(30,10,0,0.3)'; ctx.fill();
      for (let q = 0; q < 3; q++) drawStar(ctx, mx + (q - 1) * sr * 2.65, sy, sr, q < s);
    });
  }

  return { start, has: (k) => !!wonderByKey(k), update, render, pointerDown, pointerMove, pointerUp, press, drawExtras, resize() { S.snap = true; if (S.backdrop) { const z = env.size(); S.backdrop.resize(z.W, z.H, z.DPR); } }, get state() { return S; }, LEVELS: WONDER_LEVELS, toScreen, starsOf };
}
