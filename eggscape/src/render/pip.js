// Pip the penguin in play (0.8.17, level 16): the sim (sim/pip.js) moved onto the artist's rig (render/penguin.js, not
// redrawn here). drawPips draws him on his channel floor in the creature layer (under the eggs, so an egg under his
// flipper or at his beak is in front of him); pipEvent gives each moment its sound and its little word.
import { penguinPose, penguinBlend, drawPenguin, drawSnowSpray } from './penguin.js';
import { PIP } from '../sim/pip.js';
import { drawInChannel } from './ringclip.js';
import { RING_TH } from '../sim/geom.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => { const u = clamp((v - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const eio = (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
const back = (u, s = 1.6) => { u -= 1; return u * u * ((s + 1) * u + s) + 1; };
const pxAt = (ctx, x, y, k, f) => { ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); try { f(); } catch (e) { /* never break the frame */ } ctx.restore(); };
// 0.8.18: in play Pip is drawn 1.5x his sim body, from the same point between his feet (at 450x1000 he was about one egg
// tall and his face did not read). What he bumps, shoves and holds is the sim's and is unchanged. Standing he is then
// taller than his channel: what reaches past the far face of the ring above (his hat's top) is only a faint ghost, so
// he never sits over that ring's eggs and their eggs never sit on his face (1.7x put his eyes up there).
export const PIP_PLAY = 1.5;
const DM = {}; // per penguin: the boing's start, the wind-up's start
let CALM = false;
export function pipCalm(on) { CALM = !!on; }

// the pose and its one-shot progress for a sim phase
function lookOf(P) {
  const u = P.dur > 0 ? clamp(1 - P.t / P.dur, 0, 1) : 0;
  switch (P.ph) {
    case 'waddle': return ['waddle', 0.001 + P.st / 0.2];
    case 'tuck': return ['windup', 0.32 * Math.sin(u * Math.PI)]; // a bob down to scoop it under the flipper
    case 'windup': return ['windup', u];
    case 'slide': return ['slide', clamp(P.st / PIP.dive, 0, 1)];
    case 'boing': return ['slide', 1];
    case 'fall': return ['fall', clamp(P.st / PIP.fall, 0, 1)];
    case 'out': return ['fall', 0.45 + 0.55 * clamp(P.st / 1.1, 0, 1)];
    case 'land': return ['wave', 0];
    case 'bump': return ['bump', u];
    case 'dizzy': return ['dizzy', 0];
    case 'shake': return ['shake', u];
    case 'wave': case 'cheer': return ['wave', 0];
    case 'sneeze': return ['sneeze', u];
    case 'sulk': return ['defeated', clamp((99 - P.t) / 1.4, 0, 1)];
    default: return ['idle', 0];
  }
}

// the wind-up's telegraph on the floor: a row of chevrons running the way he is about to slide (fades in with the wiggle)
function slideMark(ctx, P, k, t) {
  const u = P.dur > 0 ? clamp(1 - P.t / P.dur, 0, 1) : 0, A = ss(0, 0.35, u) * (1 - ss(0.92, 1, u));
  if (A < 0.02) return;
  const r = P.r - 0.07, n = 5;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const f = 0.55 + i * 0.32, run = CALM ? 0 : ((t * 2.2 - i * 0.22) % 1 + 1) % 1, a = P.a + (P.face * f) / r;
    const al = A * (0.35 + 0.65 * (CALM ? 0.7 : Math.sin(run * Math.PI))) * (1 - i / (n + 1));
    const c = Math.cos(a), s = Math.sin(a), tx = -s * P.face, ty = c * P.face, w = 0.09;
    const px = r * c, py = r * s, hx = px - tx * w, hy = py - ty * w;
    ctx.beginPath(); ctx.moveTo(hx + c * w * 0.9, hy + s * w * 0.9); ctx.lineTo(px, py); ctx.lineTo(hx - c * w * 0.9, hy - s * w * 0.9);
    ctx.strokeStyle = `rgba(20,40,80,${0.55 * al})`; ctx.lineWidth = Math.max(0.05, 5 / k); ctx.stroke();
    ctx.strokeStyle = `rgba(235,250,255,${al})`; ctx.lineWidth = Math.max(0.03, 2.6 / k); ctx.stroke();
  }
  ctx.restore();
}

export function drawPips(ctx, sim, t, k) {
  for (const P of sim.pips || []) {
    if (P.ph === 'wait' || P.ph === 'away' || P.ph === 'gone') continue;
    const D = DM[P.id] || (DM[P.id] = { ph: '', t0: 0 });
    if (D.ph !== P.ph) { D.ph = P.ph; D.t0 = t; }
    if (P.ph === 'windup') slideMark(ctx, P, k, t);
    const [st, u] = lookOf(P);
    const pose = penguinBlend('pip' + P.id, penguinPose(st, t, u), t, P.ph === 'bump' || P.ph === 'fall' || P.ph === 'boing' ? 24 : 11);
    const s = PIP.m * k * PIP_PLAY; // px per 100 rig units (PIP.m metres per 100 units, k px per metre), drawn PIP_PLAY bigger
    const x = P.r * Math.cos(P.a), y = P.r * Math.sin(P.a);
    let alpha = P.alpha ?? 1, pop = 1, hop = 0, sq = 0;
    if (P.ph === 'in') { const v = clamp(1 - P.t / Math.max(0.01, P.dur), 0, 1); pop = 0.2 + 0.8 * back(ss(0, 1, v)); alpha *= ss(0, 0.3, v); }
    if (P.ph === 'boing') { const v = clamp(1 - P.t / Math.max(0.01, P.dur), 0, 1); hop = Math.sin(v * Math.PI) * 0.22 * (1 - v * 0.4); sq = v < 0.18 ? Math.sin((v / 0.18) * Math.PI) * 0.25 : 0; }
    const body = () => pxAt(ctx, x, y, k, () => {
      ctx.rotate(Math.atan2(-Math.cos(P.a), -Math.sin(P.a)));
      ctx.globalAlpha *= alpha;
      if (hop || sq) { ctx.translate(0, -hop * k); ctx.scale(1 + sq * 0.6, 1 - sq); }
      if (pop !== 1) ctx.scale(pop, pop);
      const out = {};
      drawPenguin(ctx, 0, 0, s, t, pose, { face: P.face, out, eye: P.ph === 'fall' && u > 0.3 ? 'happy' : undefined });
      if (P.ph === 'slide' && out.front && !CALM) drawSnowSpray(ctx, out.front.x, out.front.y, s, t, { k: clamp(Math.abs(P.v) / 2, 0.15, 1) * ss(0.3, 0.8, clamp(P.st / PIP.dive, 0, 1)), face: Math.sign(P.v) || P.face });
    });
    // the far face of the ring above his channel (none over the innermost channel); dropping through a gap he leaves
    // his channel, so the line slides away over a quarter second instead of letting go at once
    const above = sim.rings[P.ch - 1];
    if (!above) { body(); continue; }
    if (P.ph === 'fall' || P.ph === 'out') { if (D.drop == null) D.drop = t; } else D.drop = null;
    const drop = D.drop == null ? 0 : ss(0, 0.3, t - D.drop);
    if (drop >= 1) { body(); continue; }
    drawInChannel(ctx, above.r - RING_TH / 2 - drop * 1.2, false, 0.32, body);
  }
}

// sounds, puffs and words (main.js passes popup, audio, once)
export function pipEvent(ev, fx, api) {
  const { popup, audio } = api;
  switch (ev.type) {
    case 'pipIn': audio.play('flap', { vol: 0.5, pitch: 1.4 }); fx.dust?.(ev.x, ev.y, 6, 'rgba(240,250,255,0.85)'); break;
    case 'pipWarn': audio.play('squish', { vol: 0.35, pitch: 1.7, intensity: 0.3 }); break;
    case 'pipSlide': audio.play('wind_gust', { vol: 0.3, pitch: ev.why === 'sneeze' ? 2 : 1.6 }); fx.dust?.(ev.x, ev.y, 4, 'rgba(240,250,255,0.8)'); break;
    case 'pipShove': audio.play('rock_hit', { vol: 0.35, pitch: 1.5 }); audio.play('egg_bump', { vol: 0.45, intensity: 0.4 }); break;
    case 'pipShoveIn': audio.play('cheer_up', { vol: 0.45, pitch: 1.2 }); break;
    case 'pipTuck': audio.play('squish', { vol: 0.3, pitch: 1.4, intensity: 0.2 }); break;
    case 'pipGrab': audio.play('grab', { vol: 0.5, pitch: 1.35 }); break;
    case 'pipFall': audio.play('cheer_up', { vol: 0.6, pitch: 1.55 }); popup(ev.x, ev.y + 0.55, 'Wheee!', { color: '#bfeaff', size: 20, life: 1.1 }); break;
    case 'pipLand': audio.play('egg_land', { vol: 0.35, pitch: 1.5 }); fx.dust?.(ev.x, ev.y, 5, 'rgba(240,250,255,0.85)'); break;
    case 'pipBump': audio.play('rock_hit', { vol: 0.55, pitch: 1.25 }); audio.play('stun_stars', { vol: 0.6, pitch: 1.3 }); popup(ev.x, ev.y + 0.5, 'Bonk!', { color: '#ffe27a', size: 20, life: 1.0 }); break;
    case 'pipBoing': audio.play('bubble_on', { vol: 0.5, pitch: 0.7 }); popup(ev.x, ev.y + 0.5, 'Boing!', { color: '#ffe8a0', size: 20, life: 1.0 }); break;
    case 'pipDrop': if (ev.why !== 'end') audio.play('release', { vol: 0.35, pitch: 1.3 }); break;
    case 'pipHit':
      if (ev.kind === 'ice') { audio.play('cheer_up', { vol: 0.55, pitch: 1.4 }); popup(ev.x, ev.y + 0.6, 'Brrr-illiant!', { color: '#bfeaff', size: 18, life: 1.2 }); }
      else if (ev.kind === 'pepper') audio.play('wind_gust', { vol: 0.45, pitch: 2.2 });
      else if (ev.kind === 'scare' || ev.kind === 'out') audio.play('flap', { vol: 0.5, pitch: 1.2 });
      else audio.play('stun_stars', { vol: 0.6, pitch: 1.3 });
      break;
  }
}

// ---------- the level card (howto.js, through howact.js ACTORS.penguin): Pip winds up on the right and belly-slides at the
// egg; the ring turns a thorn wall into his path (and the gap under the egg): BONK, he sees stars, the egg drops home.
// S: howact.js's stage (at(phi, lift), k px per metre, floor, eggS, th, T, t, m, calm). Returns what the stage needs.
const SPIKE = ['#d23a3a', '#3a0d0d', '#ff8a7a'];
function stageWall(ctx, S, phi) {
  const s = Math.max(6, 0.2 * S.k);
  for (let i = -1; i <= 1; i++) {
    const p = S.at(phi + (i * 0.11 * S.k) / S.floor, 0), rot = Math.atan2(S.C.x - p.x, p.y - S.C.y), h = s * (i ? 0.8 : 1.05);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(rot);
    ctx.beginPath(); ctx.moveTo(-h * 0.45, 2); ctx.lineTo(0, -h); ctx.lineTo(h * 0.45, 2); ctx.closePath();
    ctx.fillStyle = SPIKE[0]; ctx.fill(); ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, h * 0.12); ctx.strokeStyle = SPIKE[1]; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-h * 0.12, -h * 0.2); ctx.lineTo(-h * 0.02, -h * 0.78); ctx.strokeStyle = SPIKE[2]; ctx.lineWidth = Math.max(1.2, h * 0.07); ctx.stroke();
    ctx.restore();
  }
}
const G0 = -0.36; // the gap starts left of the egg; the ring turns +0.36 (to the right) and brings it under the egg
export const pipActor = {
  stage: () => ({ g0: G0, dTh: -G0, hand: [-0.52, -0.16], pan: -0.15 }),
  aim: (S) => S.at(0.6, 0.25 * S.k),
  draw(ctx, S) {
    const { T, t, k } = S, s = PIP.m * k, fr = (PIP.front * k) / S.floor, eh = (S.eggS * 0.5) / S.floor;
    const w0 = eh + (0.16 * k) / S.floor, turn = (T2) => -G0 * eio(clamp((T2 - 1.45) / 0.8, 0, 1)); // the stage's own turn (howto.js 'turn': 1.45-2.25 s)
    const wAt = (T2) => w0 + (S.m === 'turn' ? turn(T2) : 0);
    const p0 = w0 - G0 + fr + 0.34, vs = 0.52, go = 1.15;
    const pAt = (T2) => (T2 < go ? p0 : p0 - vs * (T2 - go) * Math.min(1, 0.45 + (T2 - go) * 1.4));
    let Tc = 99;
    for (let T2 = go; T2 < 3.2; T2 += 0.02) if (pAt(T2) - fr <= wAt(T2)) { Tc = T2; break; }
    const wa = w0 + (S.m === 'turn' ? S.th : 0);
    let phi = pAt(Math.min(T, Tc)), st = 'idle', u = 0, eye;
    if (T >= Tc) { phi = Math.max(phi, wa + fr + (0.1 * k) / S.floor); const b = (T - Tc) / PIP.bump; if (b < 1) { st = 'bump'; u = b; } else { st = 'dizzy'; eye = 'spiral'; } }
    else if (T >= go) { st = 'slide'; u = clamp((T - go) / PIP.dive, 0, 1); }
    else if (T >= 0.25) { st = 'windup'; u = clamp((T - 0.25) / (go - 0.25), 0, 1); }
    stageWall(ctx, S, wa);
    if (st === 'windup') { // the chevrons: the way he is about to go
      const A = ss(0, 0.3, u) * (1 - ss(0.92, 1, u));
      for (let i = 0; i < 4; i++) {
        const run = S.calm ? 0.7 : Math.sin((((t * 2.2 - i * 0.22) % 1) + 1) % 1 * Math.PI), q = S.at(phi - (0.5 + i * 0.32) * k / S.floor, 0.06 * k), w = 0.09 * k;
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(-phi); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha *= A * (0.35 + 0.65 * run) * (1 - i / 5);
        ctx.beginPath(); ctx.moveTo(w, -w * 0.9); ctx.lineTo(0, 0); ctx.lineTo(w, w * 0.9);
        ctx.strokeStyle = 'rgba(20,40,80,0.55)'; ctx.lineWidth = Math.max(3, 0.05 * k); ctx.stroke();
        ctx.strokeStyle = '#ebfaff'; ctx.lineWidth = Math.max(1.6, 0.026 * k); ctx.stroke();
        ctx.restore();
      }
    }
    const p = S.at(phi, 0), out = {};
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-phi);
    drawPenguin(ctx, 0, 0, s, t, penguinPose(st, t, u), { face: -1, out, eye: st === 'windup' ? 'lock' : eye });
    if (st === 'slide' && out.front && !S.calm) drawSnowSpray(ctx, out.front.x, out.front.y, s, t, { k: 0.8 * ss(0.3, 0.8, u), face: -1 });
    ctx.restore();
    const wp = S.at(wa, 0.55 * k);
    return { threat: T < Tc, bonk: T >= Tc ? clamp((T - Tc) / 0.55, 0, 1) : 0, x: wp.x, y: wp.y - 0.2 * k, own: true };
  },
};
