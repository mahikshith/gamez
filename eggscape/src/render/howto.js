// "Show, don't tell" (2026-11-20, mykee's friend: "nobody reads the instructions"). A short looping cartoon on the level
// page for each villain: the villain goes for an egg, a hand shows the one move that beats it (turn the ring, tap a
// chick, call Papa Rooster, roll a stone egg, step aside from a falling hazard), the villain is bonked, frozen or
// scared off, and the egg drops into the basket. The same stage shows a chick's power on the Chicks tab.
//
//   drawHowTo(ctx, plan, x, y, w, h, t, o)   plan = howToPlan(kind) or chickPlan(id); t = seconds (loops every LOOP s)
//     o.rooster(ctx, x, y, s)  Papa Rooster's head for the call button (main.js allyIcon)
//     o.calm                   reduced motion: the key frame of the move, standing still
//     o.world                  the game's own art (main.js howWorld): { ringR (m), back, ring, egg, nest } draws the
//                              level's real backdrop, ring slab, egg and nest instead of the flat stand-ins below
//
// The stage: the bottom of a big ring seen from inside (its centre above the panel), a gap in it, the basket below.
// Everything on the ring turns with it; the egg stays at the lowest point and drops when the gap comes under it.

import { drawVillainPortrait } from './villain-art.js';
import { drawHand } from './wonder.js';
import { drawStrikeChick } from './strike.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u); };
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
export const LOOP = 4.6;

// the move that beats each villain, and the one line under the cartoon (short: the picture does the talking)
const P = (move, cap, more = {}) => ({ move, cap, ...more });
const SHOW = {
  weasel: P('turn', 'Turn the ring as it crouches: BONK!', { fx: 'bonk' }),
  'boss:weasel': P('turn', 'Turn the ring on it, then drop an egg on it', { fx: 'bonk' }),
  snake: P('turn', 'Turn the gap away from its head', { fx: 'bonk' }),
  'boss:snake': P('tap', 'Tap your chick, then run the eggs home', { power: 'thunder', fx: 'zap' }),
  rats: P('turn', 'Turn a gap under the rolling egg', { fx: 'bonk' }),
  'boss:ratking': P('turn', 'Trap him with a ring turn, then hit him', { fx: 'bonk' }),
  octopus: P('tap', 'Zap it with a chick: it lets the egg go', { power: 'thunder', fx: 'zap' }),
  fish: P('drop', 'Drop an egg on them: they scatter', { fx: 'flee' }),
  frog: P('tap', 'A chick scares it off', { power: 'bomb', fx: 'blast' }),
  eagle: P('turn', 'Turn a wall over the egg: the eagle bonks', { fx: 'bonk' }),
  'boss:eagle': P('turn', 'Turn a wall over the egg it dives at', { fx: 'bonk' }),
  salamander: P('turn', 'Turn its ring: it slides off', { fx: 'bonk' }),
  'boss:salamander': P('dodge', 'Roll eggs off the glowing mark', { haz: 'lava' }),
  spike: P('stone', 'Roll a stone egg into it: it flips over'),
  'boss:golem': P('stone', 'Roll a stone egg into him: he flips'),
  'boss:blizzard': P('tap', 'Freeze him with a chick, then hurry', { power: 'freeze', fx: 'freeze' }),
  chameleon: P('turn', 'Grab the orbs first, turn him away', { fx: 'bonk' }),
  hermit: P('turn', 'Turn a gap under it: the egg drops free', { fx: 'bonk' }),
  puffer: P('tap', 'A zap pops it', { power: 'thunder', fx: 'zap' }),
  jelly: P('tap', 'Zap it with a chick to stun it', { power: 'thunder', fx: 'zap' }),
  gator: P('turn', 'Turn the gap away from his jaws', { fx: 'bonk' }),
  'boss:gator': P('drop', 'When he is dizzy, drop an egg on him', { fx: 'dizzy' }),
  turtle: P('drop', 'Drop an egg on its shell: it flips', { fx: 'flip' }),
  mosquito: P('tap', 'A chick blasts them away', { power: 'bomb', fx: 'blast' }),
  spider: P('wait', 'Slip the egg past while it spins'),
  beetle: P('turn', 'Turn the ring: he walks into a wall', { fx: 'bonk' }),
  jack: P('turn', 'Park it short of a gap, then let go', { fx: 'bonk' }),
  'boss:kingcrab': P('turn', 'Turn the ring while a claw is in', { fx: 'bonk' }),
  'boss:owl': P('tap', 'Stun it with a chick, then slip past', { power: 'thunder', fx: 'zap' }),
  icicles: P('dodge', 'Turn the egg away before they fall', { haz: 'icicles' }),
  lava: P('dodge', 'Roll the egg off the glowing mark', { haz: 'lava' }),
  lightning: P('dodge', 'Turn the egg away from the flicker', { haz: 'lightning' }),
  embers: P('dodge', 'Keep the egg out from under the embers', { haz: 'embers' }),
  quake: P('wait', 'Park the egg in a dip, then move'),
  rain: P('wait', 'Turn in small steps, let eggs settle'),
  current: P('wait', 'Let the current carry the egg to a gap'),
  gusts: P('wait', 'Put a wall in the way of the wind'),
  popthorns: P('wait', 'Wait for the thorns to drop, then go'),
  vines: P('wait', 'Drop through before the vine closes'),
  curse: P('dodge', 'Steer the egg round the curse orb', { haz: 'curse' }),
  thornorb: P('dodge', 'Steer the egg round the thorn orb', { haz: 'thornorb' }),
};
export function howToPlan(kind) {
  const p = SHOW[kind] || SHOW[String(kind).replace(/^boss:/, '')] || P('turn', 'Turn the ring to keep the egg away', { fx: 'bonk' });
  return { kind, ...p };
}
// no villain in this level: the basic move
export const BASIC = { kind: null, move: 'basic', cap: 'Drag a ring to turn it. Drop eggs into the basket.' };
// Papa Rooster (the farm friend): tap him and he chases a thief off, the egg comes back
export const ROOSTER = { kind: 'weasel', move: 'rooster', fx: 'flee', cap: 'Tap Papa Rooster: he chases the thief away' };
// a chick's power on the Chicks tab: tap the chick, its power hits a villain
const CHICK_FX = { freeze: 'freeze', thunder: 'zap', bomb: 'blast', decoy: 'flee', tornado: 'blast', glue: 'glue', phoenix: 'carry', tock: 'stop', bubble: 'bubble' };
export function chickPlan(id, cap, villain = 'snake') {
  return { kind: villain, move: 'tap', power: id, fx: CHICK_FX[id] || 'zap', cap };
}
const PCOL = { freeze: '#8fd8ff', thunder: '#ffe14a', bomb: '#ff8a3a', decoy: '#ffd0a0', tornado: '#9ff0d6', glue: '#c9a3ff', phoenix: '#ff9a3a', tock: '#ffd27a', bubble: '#9be8ff', rooster: '#ff5a3a' };

// ------------------------------------------------------------------ the stage
export function drawHowTo(ctx, plan, x, y, w, h, t, o = {}) {
  o._drop = null; o._carry = null; o._bubble = 0;
  const calm = !!o.calm, T = calm ? 2.25 : ((t % LOOP) + LOOP) % LOOP;
  const fade = calm ? 1 : Math.min(seg(T, 0, 0.25), 1 - seg(T, LOOP - 0.3, LOOP));
  const U = h, Z = Math.min(h, w * 0.62), cx = x + w / 2; // U: the stage's height (vertical placing); Z: the size of things (a tall stage does not blow them up)
  const Wd = o.world || null;
  ctx.save();
  // the panel: the level's own backdrop (else a soft sky and a meadow strip), rounded
  rr(ctx, x, y, w, h, Math.min(18, h * 0.08)); ctx.clip();
  if (!(Wd && Wd.back && Wd.back(ctx, x, y, w, h))) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, o.sky0 || '#9fdcff'); g.addColorStop(0.7, o.sky1 || '#e6f7ff'); g.addColorStop(1, o.sky1 || '#e6f7ff');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = o.ground || '#8bd36a'; ctx.beginPath(); ctx.ellipse(cx, y + h * 1.06, w * 0.75, h * 0.2, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = fade;

  // ring geometry: centre above the panel; phi = 0 is straight down
  // with the game's art the ring, the egg and the villain keep their in-game sizes (k = pixels per metre)
  const R = Wd ? Math.min(w * 0.86, h * 1.3) : w * 0.94, kW = Wd ? R / Wd.ringR : 0, band = Wd ? 0.16 * kW : Z * 0.12, floor = R - band / 2;
  const C = { x: cx, y: y + U * (Wd ? 0.6 : 0.64) - R };
  const at = (phi, lift) => ({ x: C.x + Math.sin(phi) * (floor - lift), y: C.y + Math.cos(phi) * (floor - lift) });
  const nest = { x: cx, y: y + U * 0.93 };
  const eggS = Wd ? 0.56 * 1.06 * kW : Z * 0.24, vD = Z * (Wd ? 0.8 : 0.5), m = plan.move;
  const vLift = vD * (Wd ? 0.3 : 0.42);
  // where the villain stops: its nose just short of the egg, worked out in pixels so a big villain never overlaps it
  const vEnd = -Math.asin(clamp((eggS * 0.42 + vD * 0.46) / floor, 0.05, 0.95));
  const drawE = (X, Y, S, st, wr) => (Wd ? Wd.egg(ctx, X, Y, st, wr, C, kW, t) : egg(ctx, X, Y, S, st, T, wr));

  // ---- the timeline of each move -> ring turn th, egg angle eA, egg drop eD (0..1), villain angle vA, villain state
  let th = 0, eA = 0, eD = 0, vA = -0.75, vOff = 0, vRot = 0, vAlpha = 1, vFx = '', fxK = 0, hand = null, stone = false, haz = null, btn = null, shot = null, done = 0;
  const gap0 = 0.4; // the gap starts to the right of the egg
  const walk = ease(seg(T, 0.2, 1.3));
  if (m === 'basic') {
    vAlpha = 0;
    const d = ease(seg(T, 0.9, 1.9)); th = -gap0 * d;
    hand = dragHand(at, T, 0.9, 1.9, 0.5, 0.5 - gap0);
    eD = seg(T, 2.0, 2.45); done = seg(T, 2.45, 2.8);
  } else if (m === 'turn') {
    vA = vEnd - 0.3 * (1 - walk);
    const d = ease(seg(T, 1.45, 2.25)); th = -gap0 * d;
    hand = dragHand(at, T, 1.35, 2.25, 0.5, 0.5 - gap0);
    if (T > 1.85) { vFx = plan.fx || 'bonk'; fxK = seg(T, 1.85, 2.9); }
    vA += th;
    if (vFx) { vOff = 1; vRot = -fxK * 3.5; vAlpha = 1 - seg(T, 2.55, 2.95); }
    eD = seg(T, 2.3, 2.75); done = seg(T, 2.75, 3.1);
  } else if (m === 'tap' || m === 'rooster') {
    vA = vEnd - 0.3 * (1 - walk);
    btn = { x: x + Math.max(w * 0.1, Z * 0.16), y: y + U * 0.8, r: Z * 0.13, id: m === 'rooster' ? 'rooster' : plan.power || 'thunder' };
    hand = tapHand(btn, T, 1.25, 1.7);
    const hit = 2.15;
    const onEgg = plan.fx === 'carry' || plan.fx === 'bubble'; // the phoenix and the bubble go for the egg, not the villain
    if (T > 1.62 && T < hit) { const k = ease(seg(T, 1.62, hit)), v = onEgg ? at(0, eggS * 0.5) : at(vA, vLift); shot = { x: btn.x + (v.x - btn.x) * k, y: btn.y + (v.y - btn.y) * k - Math.sin(k * Math.PI) * U * 0.25, k }; }
    if (T >= hit) {
      vFx = m === 'rooster' ? 'flee' : plan.fx || 'zap'; fxK = seg(T, hit, hit + 1.2);
      if (plan.fx === 'carry') { vFx = ''; o._carry = ease(seg(T, hit, hit + 0.9)); }
      if (plan.fx === 'bubble') { o._bubble = 1; vFx = T > hit + 0.35 ? 'dizzy' : ''; fxK = seg(T, hit + 0.35, hit + 1.4); }
    }
    if (vFx === 'flee' || vFx === 'blast') { vOff = vFx === 'blast' ? 1 : 0; if (vFx === 'flee') vA -= ease(fxK) * 0.9; vRot = vFx === 'blast' ? -fxK * 6 : 0; vAlpha = 1 - seg(T, hit + 0.6, hit + 1.1); }
    const d = ease(seg(T, 2.75, 3.3)); th = -gap0 * d;
    if (vFx !== 'flee' && vFx !== 'blast') vA += th; // a frozen or stunned villain rides the ring
    eD = seg(T, 3.3, 3.7); done = seg(T, 3.7, 4.0);
    if (o._carry != null) { th = 0; eD = 0; done = seg(T, hit + 0.9, hit + 1.2); }
  } else if (m === 'stone') {
    stone = T > 0.7; vA = vEnd + 0.05;
    const d = ease(seg(T, 1.3, 2.0)); th = 0.3 * d; eA = 0.48 - 0.5 * d; // turning the ring rolls the stone egg down into it
    hand = dragHand(at, T, 1.2, 2.0, -0.2, 0.1);
    if (T > 1.95) { vFx = 'flip'; fxK = seg(T, 1.95, 3.0); vRot = Math.PI * ease(seg(T, 1.95, 2.3)); vA -= 0.6 * seg(T, 2.2, 3.0); vAlpha = 1 - seg(T, 2.5, 3.0); }
    const d2 = ease(seg(T, 2.3, 2.9)); th = 0.3 * d + (-gap0 - 0.3) * d2; eA = (0.48 - 0.5 * d) * (1 - d2);
    eD = seg(T, 2.95, 3.35); done = seg(T, 3.35, 3.7);
  } else if (m === 'drop') { // an egg from the ring above lands on the villain
    vA = vEnd - 0.3 * (1 - walk); eA = 0;
    const fall = seg(T, 1.6, 2.05);
    if (T > 2.0) { vFx = plan.fx || 'dizzy'; fxK = seg(T, 2.0, 3.0); if (vFx === 'flee') { vA -= ease(fxK) * 0.9; vAlpha = 1 - seg(T, 2.5, 3.0); } if (vFx === 'flip') { vRot = Math.PI * ease(seg(T, 2.0, 2.3)); vAlpha = 1 - seg(T, 2.6, 3.1); } }
    hand = dragHand(at, T, 1.1, 1.6, 0.9, 0.55, 0.55);
    const d = ease(seg(T, 2.6, 3.2)); th = -gap0 * d;
    if (vFx !== 'flee') vA += th;
    eD = seg(T, 3.25, 3.65); done = seg(T, 3.65, 4.0);
    o._drop = { fall, vA };
  } else if (m === 'dodge') {
    haz = { k: plan.haz || 'lava', warn: seg(T, 0.2, 0.6) * (1 - seg(T, 2.35, 2.5)), fall: seg(T, 2.0, 2.4), boom: seg(T, 2.4, 3.0) };
    vAlpha = 0;
    const d = ease(seg(T, 1.0, 1.7)); th = 0.5 * d; eA = 0.5 * d; // the turn carries the egg off the mark
    hand = dragHand(at, T, 0.9, 1.7, -0.25, 0.25);
    const d2 = ease(seg(T, 2.9, 3.4)); th = 0.5 * d + (-gap0 - 0.5) * d2; eA = 0.5 * d * (1 - d2);
    eD = seg(T, 3.45, 3.85); done = seg(T, 3.85, 4.2);
  } else { // 'wait': something blocks the way for a beat (thorns, a web, the weather), then the egg goes through
    vAlpha = 0;
    const up = T < 1.7 ? 1 : 1 - seg(T, 1.7, 2.0);
    haz = { k: 'thorns', up };
    const d = ease(seg(T, 2.05, 2.8)); th = -gap0 * d;
    hand = dragHand(at, T, 1.95, 2.8, 0.5, 0.5 - gap0);
    eD = seg(T, 2.85, 3.25); done = seg(T, 3.25, 3.6);
  }

  // ---- the ring: a thick slab with one gap (the game's own ring when it is given)
  const gapA = gap0 + th, gw = 0.24;
  if (Wd) Wd.ring(ctx, C, kW, gapA, t);
  else {
    ctx.lineCap = 'round';
    for (const [lw, col] of [[band + 4, o.ringEdge || '#5a3416'], [band, o.ring || '#b9854e']]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      arc(ctx, C, R, gapA + gw / 2, gapA + TAU - gw / 2);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = band * 0.22;
    arc(ctx, C, R - band * 0.25, gapA + gw / 2 + 0.03, gapA + TAU - gw / 2 - 0.03);
  }
  // the basket
  if (Wd) Wd.nest(ctx, nest.x, nest.y, Math.max(Z * 0.7, eggS * 2.2), done, t); else drawBasket(ctx, nest.x, nest.y, Z * 0.42, done);
  // a hazard's warning mark on the floor, and its fall
  if (haz && haz.k === 'thorns') {
    for (let i = 0; i < 3; i++) { const p = at(0.14 + i * 0.07 + th, 0), up = haz.up; thornTri(ctx, p.x, p.y, Z * 0.07 * (0.25 + 0.75 * up), Math.atan2(C.x - p.x, p.y - C.y)); }
  } else if (haz) {
    const mk = at(0, 0);
    if (haz.warn > 0) { ctx.save(); ctx.globalAlpha *= haz.warn * (0.55 + 0.45 * Math.sin(T * 14)); ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.ellipse(mk.x, mk.y - Z * 0.01, Z * 0.13, Z * 0.04, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    const hk = haz.k === 'curse' || haz.k === 'thornorb' ? haz.k : haz.k;
    if (hk === 'curse' || hk === 'thornorb') { drawVillainPortrait(ctx, hk, mk.x, mk.y - Z * 0.09, Z * 0.2, t); }
    else if (haz.boom <= 0 || haz.boom < 1) {
      const top = y + Z * 0.2, sy = top + (mk.y - Z * 0.1 - top) * ease(haz.fall);
      if (haz.boom <= 0) { ctx.beginPath(); ctx.arc(mk.x, sy, Z * 0.16, 0, TAU); ctx.fillStyle = 'rgba(30,36,52,0.85)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#ff6a4a'; ctx.stroke(); drawVillainPortrait(ctx, hk, mk.x, sy, Z * 0.3, t); }
      if (haz.boom > 0) burst(ctx, mk.x, mk.y - Z * 0.05, Z * 0.22 * (0.5 + haz.boom), 1 - haz.boom, hk === 'icicles' ? '#d9f4ff' : hk === 'lightning' ? '#fff27a' : '#ff8a3a');
    }
  }
  // ---- the villain on the ring
  if (vAlpha > 0.01 && plan.kind) {
    const v = at(vA, vLift);
    ctx.save(); ctx.globalAlpha *= vAlpha;
    // knocked back (bonk / blast): off to the left, a little up, then tumbling down out of the vault
    const kb = vOff && (vFx === 'bonk' || vFx === 'blast') ? ease(fxK) : 0, kx = -w * (Wd ? 0.26 : 0.45) * kb, ky = -Z * 0.3 * Math.sin(Math.PI * Math.min(1, kb * 1.4)) + U * 0.7 * kb * kb;
    ctx.translate(v.x + kx, v.y + ky);
    if (vRot) ctx.rotate(vRot);
    ctx.rotate(-vA * 0.6);
    if (vFx === 'flee') ctx.scale(-1, 1);
    drawVillainPortrait(ctx, plan.kind, 0, 0, vD, vFx === 'freeze' || vFx === 'stop' || vFx === 'glue' ? 0 : t);
    if (vFx === 'freeze' && fxK > 0) { ctx.globalAlpha *= 0.55 * Math.min(1, fxK * 4); ctx.fillStyle = '#bfe6ff'; ctx.beginPath(); ctx.ellipse(0, 0, vD * 0.48, vD * 0.42, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#2f6f9e'; ctx.lineWidth = 3; ctx.stroke(); }
    if (vFx === 'glue' && fxK > 0) { ctx.globalAlpha *= 0.6; ctx.fillStyle = '#c9a3ff'; ctx.beginPath(); ctx.ellipse(0, vD * 0.3, vD * 0.5, vD * 0.16, 0, 0, TAU); ctx.fill(); }
    if (vFx === 'bubble' && fxK > 0) { ctx.strokeStyle = 'rgba(160,230,255,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, vD * 0.55, 0, TAU); ctx.stroke(); }
    ctx.restore();
    if ((vFx === 'zap' || vFx === 'dizzy' || vFx === 'flip' || vFx === 'stop') && fxK > 0 && fxK < 1) dizzy(ctx, v.x, v.y - vD * 0.5, vD * 0.35, T, 1 - fxK);
    if (vFx === 'zap' && fxK < 0.4) zig(ctx, v.x, v.y, vD * 0.6, T, 1 - fxK / 0.4);
    if ((vFx === 'bonk' || vFx === 'flip') && fxK < 0.5) { ctx.save(); ctx.globalAlpha *= 1 - seg(fxK, 0.3, 0.5); word(ctx, 'BONK!', Math.max(x + Z * 0.45, Math.min(cx - w * 0.12, v.x + vD * 0.3)), Math.max(y + Z * 0.16, v.y - vD * 0.3), Z * 0.16 * (1 + 0.3 * (1 - seg(fxK, 0, 0.12))), '#fff', '#c9342c'); ctx.restore(); }
    if (vFx === 'blast' && fxK < 0.4) burst(ctx, v.x, v.y, vD * (0.45 + fxK), 1 - fxK / 0.4, PCOL[plan.power] || '#ff8a3a');
  }
  // ---- the egg: on the floor at its angle, or dropping through the gap to the basket
  {
    const base = at(eA, eggS * 0.5);
    let ex = base.x, ey = base.y, sq = 1;
    if (o._drop && o._drop.fall < 1 && m === 'drop') { // the egg from above, falling onto the villain
      const top = y - U * 0.12, tgt = at(o._drop.vA, vD * 0.75);
      if (o._drop.fall > 0) { const k = o._drop.fall * o._drop.fall; drawE(tgt.x, top + (tgt.y - top) * k, eggS, false); }
      else drawE(tgt.x, top, eggS, false);
    }
    const land = nest.y - (Wd ? eggS * 0.42 : Z * 0.08);
    if (eD > 0) { const k = eD * eD; ex = base.x + (nest.x - base.x) * eD; ey = base.y + (land - base.y) * k; if (eD >= 1) sq = 1; }
    if (o._carry != null && o._carry > 0) { const k = o._carry; ex = base.x + (nest.x - base.x) * k; ey = base.y + (land - base.y) * k - Math.sin(k * Math.PI) * U * 0.35; ctx.save(); ctx.globalAlpha *= 1 - seg(k, 0.85, 1); drawStrikeChick(ctx, 'phoenix', ex, ey - eggS * 0.7, eggS * 1.3, t, {}); ctx.restore(); }
    if (done > 0) { ex = nest.x; ey = land; }
    if (o._bubble && !eD && !done) { ctx.save(); ctx.strokeStyle = 'rgba(150,225,255,0.95)'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(190,240,255,0.25)'; ctx.beginPath(); ctx.arc(ex, ey, eggS * 0.75, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); }
    const worry = !eD && vAlpha > 0.5 && plan.kind && Math.abs(vA - eA) < 0.7;
    drawE(ex, ey, eggS * sq, stone, worry);
  }
  // the power or the rooster on its way
  if (btn) {
    ctx.save();
    const pr = btn.r * (hand && hand.press ? 0.92 : 1);
    ctx.beginPath(); ctx.arc(btn.x, btn.y + 3, pr, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
    ctx.beginPath(); ctx.arc(btn.x, btn.y, pr, 0, TAU); ctx.fillStyle = btn.id === 'rooster' ? '#ffcf4a' : '#fff4dc'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#7a4a12'; ctx.stroke();
    if (btn.id === 'rooster') { if (o.rooster) o.rooster(ctx, btn.x, btn.y, pr * 1.3); }
    else drawStrikeChick(ctx, btn.id, btn.x, btn.y + pr * 0.15, pr * 1.45, t, {});
    ctx.restore();
  }
  if (shot) {
    const col = PCOL[btn.id] || '#fff';
    ctx.save(); ctx.globalAlpha *= 0.9;
    if (btn.id === 'rooster' && o.rooster) o.rooster(ctx, shot.x, shot.y, Z * 0.32);
    else { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(shot.x, shot.y, Z * 0.05, 0, TAU); ctx.fill(); ctx.globalAlpha *= 0.4; ctx.beginPath(); ctx.arc(shot.x, shot.y, Z * 0.09, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // the win: a tick over the basket
  if (done > 0) { ctx.save(); ctx.globalAlpha *= Math.min(1, done * 2); tick(ctx, nest.x + Z * 0.27, nest.y - Z * 0.2, Z * 0.1 * (0.6 + 0.4 * ease(done))); ctx.restore(); }
  // the hand on top of everything
  if (hand && hand.a > 0.01) drawHand(ctx, hand.x, hand.y, Z * 0.26, hand.press, hand.a * fade);
  ctx.restore();
}

// a hand that presses at angle a0 on the ring and drags to a1 between t0 and t1 (lift: how far above the floor)
function dragHand(at, T, t0, t1, a0, a1, lift = 0) {
  const a = seg(T, t0 - 0.3, t0) * (1 - seg(T, t1 + 0.1, t1 + 0.4));
  const k = ease(seg(T, t0, t1)), p = at(a0 + (a1 - a0) * k, lift - 6);
  return { x: p.x, y: p.y, press: T >= t0 && T <= t1 + 0.05, a };
}
function tapHand(b, T, t0, t1) {
  const a = seg(T, t0 - 0.35, t0) * (1 - seg(T, t1 + 0.1, t1 + 0.4));
  const press = T >= t0 + 0.12 && T <= t1;
  return { x: b.x + b.r * 0.15, y: b.y + b.r * 0.2 + (press ? 0 : b.r * 0.3), press, a };
}
function arc(ctx, C, r, a0, a1) { // angles from straight down, clockwise on screen
  ctx.beginPath();
  const n = 48;
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n), x = C.x + Math.sin(a) * r, y = C.y + Math.cos(a) * r; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.stroke();
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
// the game's egg: cream shell, a face; worried when a villain is close, grey stone when it is a stone egg
function egg(ctx, x, y, s, stone, T, worry) {
  const w = s * 0.78, h = s;
  ctx.save(); ctx.translate(x, y);
  if (worry) ctx.rotate(Math.sin(T * 22) * 0.08);
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, sy = Math.sin(a), px = (w / 2) * Math.cos(a) * (1 + 0.13 * sy), py = (h / 2) * sy; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
  ctx.closePath();
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  if (stone) { g.addColorStop(0, '#c9c4bd'); g.addColorStop(1, '#7d776f'); } else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f1dcb6'); }
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.strokeStyle = stone ? '#3e3a35' : '#6b4526'; ctx.stroke();
  // face
  const ey = h * 0.06, ex = w * 0.2, er = s * 0.065;
  ctx.fillStyle = '#2a1608';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * ex, ey, er * 0.85, er * (worry ? 1.25 : 1), 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#fff'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * ex + er * 0.3, ey - er * 0.35, er * 0.35, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#2a1608'; ctx.lineWidth = Math.max(1, s * 0.04); ctx.beginPath();
  if (worry) ctx.arc(0, ey + h * 0.2, w * 0.08, Math.PI * 1.15, Math.PI * 1.85); else ctx.arc(0, ey + h * 0.09, w * 0.1, 0.2, Math.PI - 0.2);
  ctx.stroke();
  if (!stone) { ctx.fillStyle = 'rgba(255,120,120,0.35)'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * w * 0.3, ey + h * 0.12, w * 0.08, h * 0.04, 0, 0, TAU); ctx.fill(); } }
  ctx.restore();
}
function drawBasket(ctx, x, y, w, glow) {
  ctx.save();
  if (glow > 0) { ctx.globalAlpha *= 0.5 * glow; ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.ellipse(x, y - w * 0.05, w * 0.7, w * 0.3, 0, 0, TAU); ctx.fill(); }
  ctx.restore(); ctx.save();
  const h = w * 0.36;
  ctx.fillStyle = '#5a3008'; ctx.beginPath(); ctx.ellipse(x, y - h * 0.5, w / 2, h * 0.22, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - w / 2, y - h * 0.5); ctx.quadraticCurveTo(x - w * 0.45, y + h * 0.45, x, y + h * 0.48); ctx.quadraticCurveTo(x + w * 0.45, y + h * 0.45, x + w / 2, y - h * 0.5); ctx.closePath();
  ctx.fillStyle = '#c98f3a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#4a2a0a'; ctx.stroke();
  ctx.strokeStyle = 'rgba(90,50,10,0.55)'; ctx.lineWidth = 1.5;
  for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - w * (0.48 - i * 0.04), y - h * 0.5 + i * h * 0.3); ctx.quadraticCurveTo(x, y - h * 0.3 + i * h * 0.33, x + w * (0.48 - i * 0.04), y - h * 0.5 + i * h * 0.3); ctx.stroke(); }
  ctx.lineWidth = 4; ctx.strokeStyle = '#e8b45a'; ctx.beginPath(); ctx.ellipse(x, y - h * 0.5, w / 2, h * 0.22, 0, 0, Math.PI); ctx.stroke();
  ctx.restore();
}
function thornTri(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath(); ctx.moveTo(-s * 0.45, 0); ctx.lineTo(0, -s); ctx.lineTo(s * 0.45, 0); ctx.closePath(); ctx.fillStyle = '#d23a3a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#3a0d0d'; ctx.stroke(); ctx.restore();
}
function dizzy(ctx, x, y, r, T, a) {
  ctx.save(); ctx.globalAlpha *= clamp(a * 2, 0, 1);
  for (let i = 0; i < 3; i++) { const an = T * 5 + (i * TAU) / 3, sx = x + Math.cos(an) * r, sy = y + Math.sin(an) * r * 0.35; star5(ctx, sx, sy, r * 0.28); }
  ctx.restore();
}
function star5(ctx, x, y, r) {
  ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr2 = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } ctx.closePath();
  ctx.fillStyle = '#ffd23a'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#8a5a00'; ctx.stroke();
}
function zig(ctx, x, y, r, T, a) {
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = '#fff27a'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  for (let k = 0; k < 4; k++) { const an = k * 1.6 + T * 3; ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * r * 0.3, y + Math.sin(an) * r * 0.3); ctx.lineTo(x + Math.cos(an + 0.3) * r * 0.65, y + Math.sin(an + 0.3) * r * 0.65); ctx.lineTo(x + Math.cos(an - 0.1) * r * 0.8, y + Math.sin(an - 0.1) * r * 0.8); ctx.lineTo(x + Math.cos(an + 0.2) * r * 1.05, y + Math.sin(an + 0.2) * r * 1.05); ctx.stroke(); }
  ctx.restore();
}
function burst(ctx, x, y, r, a, col) {
  ctx.save(); ctx.globalAlpha *= clamp(a, 0, 1); ctx.fillStyle = col;
  ctx.beginPath(); for (let i = 0; i < 16; i++) { const an = (i * Math.PI) / 8, rr2 = i % 2 ? r * 0.5 : r; ctx.lineTo(x + Math.cos(an) * rr2, y + Math.sin(an) * rr2); } ctx.closePath(); ctx.fill();
  ctx.restore();
}
function word(ctx, str, x, y, size, fill, stroke) {
  ctx.save(); ctx.font = `800 ${Math.round(size)}px "Fredoka", "Baloo 2", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.28; ctx.strokeStyle = stroke; ctx.strokeText(str, x, y); ctx.fillStyle = fill; ctx.fillText(str, x, y); ctx.restore();
}
function tick(ctx, x, y, r) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = '#3cb043'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.lineWidth = r * 0.28; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x - r * 0.45, y); ctx.lineTo(x - r * 0.1, y + r * 0.35); ctx.lineTo(x + r * 0.5, y - r * 0.35); ctx.stroke(); ctx.restore();
}
